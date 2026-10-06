# GD32 双系路线：基线、一手来源与缺口

## 范围（用户确认 2026-10-06）

- 双系并行：**G 篇 = GD32F4xx**（ARM Cortex-M4F，寄存器级对照 STM32F4）；**V 篇 = GD32VF103**（RISC-V Bumblebee 内核）。
- 先不定基准板卡，按芯片官方资料写；板卡接线节待用户指定后回填。

## 已取到的一手来源（存 `.trellis/ref/gd32/`）

| 来源 | 版本 / SHA | 文件（字节数） |
|---|---|---|
| `GigaDevice-GD32-MCU/GD32F4xx_Firmware_Library`（GitHub 官方组织） | main @ `10d02f4c8a7e1d79da8b2a9ad67b534f187ec936`（2026-10-06 拉取） | system_gd32f4xx.c 39,318 / gd32f4xx_rcu.h 94,588 / gd32f4xx.h 28,547 |
| `GigaDevice-Semiconductor/GD32VF103_Firmware_Library`（GitHub 官方组织） | master @ `7ab0521e96461b8833f2f4974cf6bdd1f80a7101`（2026-10-06 拉取） | system_gd32vf103.c 31,040 / gd32vf103_rcu.h 54,661 / gd32vf103.h 15,774 |
| `nucleisys/Bumblebee_Core_Doc` | master | Bumblebee_Core_Brief_Manual.pdf 472,730 |

## 已核实事实（含出处，写作直接引用）

1. GD32F4xx 标准外设库版本 **V3.3.3**（`gd32f4xx.h:93-96` 版本宏 MAIN/SUB1/SUB2/RC = 0x03/0x03/0x03/0x00）；芯片头文件覆盖 GD32F450、GD32F470（F450 200MHz / F470 240MHz 档位于下条坐实）。
2. `system_gd32f4xx.c:54-67`：官方系统时钟预设档含 **168M / 200M / 240M**（PLL 源可选 IRC16M 或 HXTAL 8M/25M）；当前生效默认档 = `__SYSTEM_CLOCK_200M_PLL_25M_HXTAL`——**官方 demo 默认 25MHz 晶振上 200MHz**。
3. `system_gd32vf103.c:48-57`：GD32VF103 预设档 **48M / 72M / 108M**（PLL 源 IRC8M）及 HXTAL 直供 / 24M / 36M。
4. GD32F4xx 外设库命名 **RCU**（`gd32f4xx_rcu.h`，不是 RCC）；CMSIS 内核头为标准 `core_cm4.h`——ARM 系与 STM32 同工具链（xPack GCC 可直接编译）。

## 资料缺口（写作时标注"待 UM 核验"）

- GD32F4xx / GD32VF103 **用户手册（UM）PDF 未取到**（gigadevice.com 可达性未测）；RCU_CFG0 位域编码、Flash 等待周期表、向量表布局在拿到 UM 前以官方库头文件+源码为准。
- RISC-V 工具链本机缺失：`riscv-none-elf-gcc` 未安装——V 篇工程构建是前置任务（建议 xPack riscv-none-elf-gcc，与现有 xPack ARM 工具链同管理器）。
- Bumblebee 手册 PDF 在手未读：CLIC 中断模型、MTIME 参数、性能计数器待提取。
- GD32F4xx 与 STM32F4 的具体外设差异点清单（USART 增强、USBHS、EXMC 等）需从库头文件 `gd32f4xx_*.h` 逐一比对后成文，禁凭印象。

## 路线设计原则

- G 篇与 S 篇同构对照：每章开头给"同名不同姓"对照表（RCC↔RCU、168↔200/240MHz），动画复用现有骨架换数字与配色。
- V 篇讲迁移：从 ARM 知识出发量 RISC-V——启动文件/链接脚本/CLIC/MTIME 四件事，不重复讲已会的 C 与外设概念。
- 事实纪律沿用主站规范：数值双来源，章节 title 与 H1 一致，动画 `![](/anim/x.svg)` 引用。
