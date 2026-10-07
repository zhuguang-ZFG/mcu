#!/bin/sh
# probe.sh —— C7《未定义行为与 MISRA-C》全部取证，一条命令跑完
#
#   sh probe.sh   1) 宿主双档对照：probe.c 用 -O0 与 -O2 各编一份，同一行代码当众变脸；
#                 2) -fwrapv 对照：加一个编译旗，-O2 的"恒真"当场收回；
#                 3) 编译器防线现场：-Wstrict-aliasing / -Warray-bounds / -Wuninitialized 抓人实录；
#                 4) UBSan 运行期点名（工具链支持时）；
#                 5) 交叉汇编：arm-none-eabi-gcc -O2 -S 看 is_bigger_after_inc 被折叠成几条指令。
#   sh probe.sh clean   删 build/
#
# 产物一律落在 build/（code/**/build/ 已 gitignore）。
#
# 想让第 5 步跑起来：把交叉工具链的 bin 目录加进 PATH，例如
#   PATH="/d/zhugu-home/tools/armgcc/xpack-arm-none-eabi-gcc-15.2.1-1.1/bin:$PATH"

set -e
cd "$(dirname "$0")"

if [ "$1" = "clean" ]; then
    rm -rf build
    exit 0
fi

mkdir -p build

HOSTCC=${CC:-gcc}

echo "############ 1. 宿主多档对照：同一行代码的几张脸 ############"
echo "宿主工具链：$HOSTCC $("$HOSTCC" -dumpfullversion 2>/dev/null || "$HOSTCC" -dumpversion)"
"$HOSTCC" -std=c11 -Wall -Wextra -Werror -O0 probe.c -o build/probe-o0.exe
"$HOSTCC" -std=c11 -Wall -Wextra -Werror -O2 probe.c -o build/probe-o2.exe
echo "----- -O0 -----"
./build/probe-o0.exe || true
echo "----- -O2 -----"
./build/probe-o2.exe || true

echo
echo "############ 2. -fwrapv 对照：一个编译旗让恒真收回 ############"
"$HOSTCC" -std=c11 -Wall -Wextra -Werror -O2 -fwrapv probe.c -o build/probe-wrapv.exe
./build/probe-wrapv.exe || true

echo
echo "############ 3. 编译器防线现场：三条警告抓人实录 ############"
echo "----- -Wstrict-aliasing：float* 强转 uint32_t* 解引用（alias-violate.c）-----"
"$HOSTCC" -std=c11 -O2 -Wstrict-aliasing -c alias-violate.c -o build/alias-violate.o 2>&1 || true
echo "----- -Warray-bounds / -Wuninitialized（oob-static.c）-----"
"$HOSTCC" -std=c11 -O2 -Wall -Wextra -c oob-static.c -o build/oob-static.o 2>&1 || true

echo
echo "############ 4. UBSan 运行期点名（工具链支持时） ############"
if "$HOSTCC" -std=c11 -O2 -fsanitize=undefined ub.c -o build/ub.exe 2>/dev/null; then
    ./build/ub.exe 2>&1 || true
else
    echo "（跳过：本工具链没有 UBSan 运行库——嵌入式交叉链上这很常见，靠第 3 步的编译期防线）"
fi

echo
echo "############ 5. 交叉汇编：is_bigger_after_inc 在 -O2 下被折叠成什么 ############"
ARMPREFIX=arm-none-eabi-
if command -v "${ARMPREFIX}gcc" >/dev/null 2>&1; then
    MCU="-mcpu=cortex-m4 -mthumb -mfpu=fpv4-sp-d16 -mfloat-abi=hard"
    echo "交叉工具链：$("${ARMPREFIX}gcc" -dumpfullversion)"
    "${ARMPREFIX}gcc" $MCU -std=c11 -O2 -S probe.c -o build/probe-arm.s
    echo "----- -O2：编译器假定溢出永不发生 → 函数体只剩"恒真"-----"
    sed -n '/^is_bigger_after_inc:/,/\.size[[:space:]]*is_bigger_after_inc/p' build/probe-arm.s | grep -Ev "^\s*(@|\.)" || true
    "${ARMPREFIX}gcc" $MCU -std=c11 -O2 -fwrapv -S probe.c -o build/probe-arm-wrapv.s
    echo "----- -fwrapv -O2：溢出按回绕定义 → 必须真算 -----"
    sed -n '/^is_bigger_after_inc:/,/\.size[[:space:]]*is_bigger_after_inc/p' build/probe-arm-wrapv.s | grep -Ev "^\s*(@|\.)" || true
else
    echo "（跳过汇编取证：PATH 里没有 arm-none-eabi-gcc；宿主对照不受影响）"
fi
