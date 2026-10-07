---
title: GD32 双系路线
---

# GD32 路线：一颗国产芯的两条进化线

兆易创新 GD32 是国内出货量最大的 MCU 家族之一，也是"学透一颗再举一反三"的最佳教材。这条路线一次讲两条线：

- **G 篇（GD32F4xx，ARM Cortex-M4F）**：STM32F407 的"近亲"——寄存器布局神似，但外设库叫 **RCU** 不叫 RCC、主频更高（**F450 200MHz / F470 240MHz**，官方库默认档就是 200MHz），USART 等外设还有增强点。逐字段对照学"兼容但不相同"。
- **V 篇（GD32VF103，RISC-V RV32IMAC）**：Bumblebee 内核 108MHz——没有 NVIC、没有 SysTick，中断走 **CLIC**、内核定时走 **MTIME**。用你已经会的 STM32 知识丈量 RISC-V，只讲迁移必需的四件事。

事实基准：官方固件库（GD32F4xx 库版本 **V3.3.3** / GD32VF103 官方库），源码按版本核对（参考缓存位于 .trellis/ref/，不随仓库分发）；用户手册（UM）PDF 尚在获取中，位域细节以官方库头文件为准并标注"待 UM 核验"。

## G 篇：GD32F4xx 对照篇

| 章 | 标题 | 带走什么 |
|---|---|---|
| **[G0 环境与工具链](/gd32/00-env.md)【成稿】** | 官方库 V3.3.3 目录解剖 | 复用 xPack ARM GCC，启动文件/system/链接脚本三件套 |
| **[G1 RCU 时钟树：200MHz 是怎么算出来的](/gd32/01-rcu-clock.md)【成稿】** | 与 S2 逐字段对照 | PLL 同布局更激进（400MHz VCO）、电压档三件套带 HDRF/HDSRF 回执、FMC_WS 官方留白、CK_OUT0 理论 50MHz |
| **[G2 GPIO 与 AF 复用对照](/gd32/02-gpio-af.md)【成稿】** | 七大寄存器"同名不同姓"点名 | 多出 BC/TG 两件兵器，编码逐位核对 |
| **[G3 USART 增强点](/gd32/03-usart.md)【成稿】** | 从 `gd32f4xx_usart.h` 比出的差异清单 | 7 个串口、CTL0/1/2 命名差异、库函数分工 |
| **[G4 GD32 外设差异](/gd32/04-periph-diff.md)【成稿】** | USBHS/EXMC/CAN 逐项"有没有、一不一样" | GD32 独有外设与 STM32 对照 |

## V 篇：GD32VF103 RISC-V 篇

| 章 | 标题 | 带走什么 |
|---|---|---|
| **[V0 RISC-V 工具链与启动](/gd32/05-riscv-toolchain.md)【成稿】** | riscv-none-elf-gcc、启动文件与链接脚本的 RISC-V 版 | 三元组+march/mabi，无 FPU/CPACR，sp 软件设 |
| **[V1 Bumblebee 内核与 CLIC 中断](/gd32/06-clic-irq.md)【成稿】** | 没有 NVIC 的世界：向量直跳 | ECLIC 两维优先级、shv 向量模式、MTIME 取代 SysTick |
| **[V2 RCU 与 108MHz](/gd32/07-rcu-108m.md)【成稿】** | G 篇知识平移（预设档 48/72/108M） | 25M 绕 PLL1 两圈、乘数全家福、回读对账 |
| **[V3 MTIME 与裸机延时](/gd32/08-mtime-delay.md)【成稿】** | 替代 SysTick 的内核时基 | 64 位读写纪律、主频除四、查询式 delay_ms |
| **[V4 GPIO 最小系统](/gd32/09-gpio-minimal.md)【成稿】** | 第一个 RISC-V 点灯闭环 | F1 血统 AFIO、四位一坑、工程拼图收官 |

## 当前状态

规划清单已登记到 docs/curriculum.json，未建页面不生成死链接，一手源码已入库核实，章节成稿与动画按批次推进；板卡接线节待指定基准板后回填。

> AI生成
