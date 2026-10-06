#!/bin/sh
# probe.sh —— S9 逐次逼近（SAR）取证（宿主机就能跑，不需要开发板，也不需要 make）
#
#   sh probe.sh            跑全部
#   sh probe.sh sar        12 轮二分表 + 最终码值 + 量化误差
#   sh probe.sh vin        换输入电压再看一轮（对照动画里的 2.00 V）
#   sh probe.sh clean
#
# 用宿主 gcc 编一个 sar_probe.exe（产物落 build/，已 gitignore）。交叉编译那份也顺手
# 造出来，证明这段代码在目标板上同样跑得动——但它不代替板上实测。

set -e
cd "$(dirname "$0")"
mkdir -p build

HOSTCC=${HOSTCC:-gcc}
ARM_PREFIX=${ARM_PREFIX:-arm-none-eabi-}
ARMCC="${ARM_PREFIX}gcc"
ARMFLAGS="-mcpu=cortex-m4 -mthumb -mfpu=fpv4-sp-d16 -mfloat-abi=hard -Os -ffunction-sections"

have() { command -v "$1" >/dev/null 2>&1; }

sar_probe() {
    have "$HOSTCC" || { echo "找不到 $HOSTCC —— 装一个宿主 gcc（或 HOSTCC=... sh probe.sh）" >&2; exit 1; }
    "$HOSTCC" -O2 -Wall -Wextra sar_probe.c -o build/sar_probe.exe
    ./build/sar_probe.exe
}

vin_probe() {
    have "$HOSTCC" || { echo "找不到 $HOSTCC" >&2; exit 1; }
    for v in 1.65 2.00 3.29; do
        "$HOSTCC" -O2 -DVIN=$v sar_probe.c -o "build/sar_$v.exe"
        printf '%s\n' "----- Vin=$v V -----"
        "./build/sar_$v.exe" | tail -3
    done
    echo "1.65 V 恰好落在半量程 0x800（误差 0.00 LSB）；3.29 V 停在 0xFF3，离满量程 0xFFF 还差 12 个码，量化误差 0.59 LSB。"
}

cross_probe() {
    have "$ARMCC" || { echo "找不到 $ARMCC —— 交叉那步跳过（本取证不依赖它）"; return 0; }
    "$ARMCC" $ARMFLAGS -c sar_probe.c -o build/sar_cross.o
    echo "交叉目标文件已生成：SAR 这段算法在 Cortex-M4 上同样编得出来（printf 由 libc 提供）。"
}

case "${1:-all}" in
    sar)   sar_probe ;;
    vin)   vin_probe ;;
    cross) cross_probe ;;
    all)   sar_probe; echo; vin_probe; echo; cross_probe ;;
    clean) rm -rf build ;;
    *)     echo "用法：sh probe.sh [sar|vin|cross|clean]" >&2; exit 1 ;;
esac
