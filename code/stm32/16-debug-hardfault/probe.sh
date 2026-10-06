#!/bin/sh
# probe.sh —— S16 章全部取证，一条命令跑完（不需要开发板）
#
#   sh probe.sh         1) 宿主 gcc 编译运行 probe.c（断言全绿退出 0）；
#                       2) 位号与 CMSIS 官方头文件逐位对账（diff 必须为空）；
#                       3) PATH 里有 arm-none-eabi-gcc 时，附送 naked
#                          HardFault_Handler 反汇编 + PC→addr2line→源码行全链路。
#   sh probe.sh clean   删 build/
#
# 产物一律落在 build/（code/**/build/ 已 gitignore）。
#
# 想让第 3 步跑起来：把交叉工具链的 bin 目录加进 PATH，例如
#   PATH="/d/zhugu-home/tools/armgcc/xpack-arm-none-eabi-gcc-15.2.1-1.1/bin:$PATH"

set -e
cd "$(dirname "$0")"

if [ "$1" = "clean" ]; then
    rm -rf build
    exit 0
fi

mkdir -p build

HOSTCC=${CC:-gcc}
CMSIS=../../../.trellis/ref/cmsis/core_cm4.h

echo "############ 1. 宿主：故障寄存器解码 + 栈帧选择（断言取证） ############"
echo "宿主工具链：$HOSTCC $("$HOSTCC" -dumpfullversion 2>/dev/null || "$HOSTCC" -dumpversion)"
"$HOSTCC" -std=c11 -Wall -Wextra -Werror -O2 probe.c -o build/probe.exe
./build/probe.exe

echo
echo "############ 2. 位号逐位对账：本文件的表 vs CMSIS 官方头文件 ############"
if [ -f "$CMSIS" ]; then
    ./build/probe.exe --dump-positions | sort > build/pos-probe.txt
    awk '
      /^#define SCB_CFSR_MEMFAULTSR_Pos/ { m = $3 + 0 }
      /^#define SCB_CFSR_BUSFAULTSR_Pos/  { b = $3 + 0 }
      /^#define SCB_CFSR_USGFAULTSR_Pos/  { u = $3 + 0 }
      /^#define SCB_CFSR_[A-Z]+_Pos/ {
        name = $2; sub(/^SCB_CFSR_/, "", name); sub(/_Pos$/, "", name)
        rest = $0
        if      (name == "MEMFAULTSR") v = m
        else if (name == "BUSFAULTSR") v = b
        else if (name == "USGFAULTSR") v = u
        else if (rest ~ /MEMFAULTSR_Pos/) v = m
        else if (rest ~ /BUSFAULTSR_Pos/) v = b
        else if (rest ~ /USGFAULTSR_Pos/) v = u
        else v = 0
        if (match(rest, /\+ *[0-9]+U/)) {
          t = substr(rest, RSTART, RLENGTH); gsub(/[^0-9]/, "", t); v += t + 0
        }
        printf "CFSR:%s %d\n", name, v
      }
      /^#define SCB_SHCSR_[A-Z]+_Pos/ {
        name = $2; sub(/^SCB_SHCSR_/, "", name); sub(/_Pos$/, "", name)
        t = $3; gsub(/[^0-9]/, "", t)
        printf "SHCSR:%s %d\n", name, t + 0
      }
      /^#define SCB_HFSR_[A-Z]+_Pos/ {
        name = $2; sub(/^SCB_HFSR_/, "", name); sub(/_Pos$/, "", name)
        t = $3; gsub(/[^0-9]/, "", t)
        printf "HFSR:%s %d\n", name, t + 0
      }
    ' "$CMSIS" | sort > build/pos-header.txt

    echo "头文件：$CMSIS"
    echo "  头文件侧 $(wc -l < build/pos-header.txt) 条位号，本章侧 $(wc -l < build/pos-probe.txt) 条位号"
    # Windows 下的 probe.exe 输出 CRLF，awk 输出 LF——对账前统一成 LF
    tr -d '\r' < build/pos-header.txt > build/pos-header.norm
    tr -d '\r' < build/pos-probe.txt > build/pos-probe.norm
    if diff -u build/pos-header.norm build/pos-probe.norm > build/pos.diff; then
        echo "  ----- 对账结果：逐位一致（$(wc -l < build/pos-header.txt) 条全中） -----"
    else
        echo "  ----- 对账结果：不一致！上面这些位号不可信 -----"
        cat build/pos.diff
        exit 1
    fi
else
    echo "（跳过对账：找不到 $CMSIS）"
fi

echo
echo "############ 3. 反汇编：naked HardFault_Handler 怎么选栈指针 ############"
ARMPREFIX=arm-none-eabi-
if command -v "${ARMPREFIX}gcc" >/dev/null 2>&1; then
    MCU="-mcpu=cortex-m4 -mthumb -mfpu=fpv4-sp-d16 -mfloat-abi=hard"
    echo "交叉工具链：$("${ARMPREFIX}gcc" -dumpfullversion)"
    "${ARMPREFIX}gcc" $MCU -std=c11 -Wall -Wextra -Werror -O0 -g3 \
        -nostdlib -Wl,--entry=fault_demo_entry -Wl,-Ttext=0x08000000 \
        -Wl,-Map=build/fault_ctx.map \
        fault_ctx.c -o build/fault_ctx.elf
    "${ARMPREFIX}objdump" -d build/fault_ctx.elf > build/fault_ctx.dis

    echo "----- HardFault_Handler 全文（tst lr,#4 → mrs msp|psp） -----"
    sed -n '/<HardFault_Handler>:/,/^$/p' build/fault_ctx.dis

    echo "----- .text 落址（Flash 0x08000000，对照 B1 的链接四步） -----"
    "${ARMPREFIX}objdump" -h build/fault_ctx.elf | grep -E '^ +[0-9]+ \.text '

    echo "----- 三具尸体的符号地址 -----"
    "${ARMPREFIX}nm" build/fault_ctx.elf | grep -E ' (crash_null|crash_unaligned|crash_divzero|HardFault_Handler|hardfault_report)$'

    ADDR=$("${ARMPREFIX}nm" build/fault_ctx.elf | awk '/ crash_null$/{print $1; exit}')
    FAULT=$("${ARMPREFIX}objdump" -d build/fault_ctx.elf \
            | sed -n '/<crash_null>:/,/^$/p' \
            | awk '/[[:space:]]str[[:space:]]/{a=$1; sub(/:$/,"",a); print a; exit}')
    [ -n "$FAULT" ] || { echo "未在 crash_null 内找到 str 指令——取证段失效" >&2; exit 1; }
    echo "----- 法医全链路：nm 给的是函数入口，栈里的 PC 才是真凶指令 -----"
    echo "crash_null 入口    = 0x$ADDR（nm 给的，指向函数第一行）"
    "${ARMPREFIX}addr2line" -e build/fault_ctx.elf -f "0x$ADDR"
    echo "crash_null 的 str  = 0x$FAULT（反汇编找的，HardFault 时栈帧里躺的就是它）"
    "${ARMPREFIX}addr2line" -e build/fault_ctx.elf -f "0x$FAULT"

    echo "----- map 文件交叉验证（同一地址的另一个出处） -----"
    grep -E 'crash_null' build/fault_ctx.map | head -2
else
    echo "（跳过反汇编：PATH 里没有 arm-none-eabi-gcc；宿主断言不受影响）"
fi
