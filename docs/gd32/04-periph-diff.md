---
title: G4 GD32 外设差异：有没有与一不一样
status: done
difficulty: 2
minutes: 30
---

# G4 GD32 外设差异：有没有与一不一样

> 🎯 G1~G3 逐个外设比了"同名不同姓"；这一章把 GD32F4xx 与 STM32F407 的外设全家拉到一张表上——**有的 GD32 多了、有的 STM32 没有、有的都有但内部有差异**。迁移前先查这张表，别等编译/运行时才发现"这个外设我没有"。

## 本章精髓

1. 有没有：GD32F4xx 比 STM32F407 多 USBHS（高速 USB）、TRNG（真随机数）、更多串口（G3）；STM32F407 有而 GD32 可能没有或不同的：OTG_FS/OTG_HS（GD32 用 USBHS 替代）。
2. 一不一样：都有 CAN/SDIO/EXMC(FSMC)/ENET，但寄存器命名与位布局有差异——GD32 统一用 CTL 命名风格（G3 已见），具体位级差异已按官方库头文件（V3.3.3）核验（EXMC/USB 见下文，CAN/ENET/SDIO 仍保留待核验项）。
3. 迁移纪律：先查"有没有"（外设存在性），再查"一不一样"（寄存器映射），最后查"引脚分配"（datasheet）——三步缺一步就翻车。

## 怎么读这一章

- **能记住**：GD32 比 STM32 多 USBHS/TRNG/3 个串口；EXMC 替代 FSMC；统一 CTL 命名。
- **能理解**：为什么"有没有"比"一不一样"更优先——外设不存在，寄存器映射再对也白搭。
- **能用**：拿到一个 STM32 工程想移植到 GD32，先用这张表扫一遍外设存在性，再逐个查寄存器。

## 学习目标

- 画出 GD32F4xx vs STM32F407 的外设"有没有"对照表。
- 对 USBHS/EXMC/CAN/ENET 四个重点外设说出"方向性差异"与待核验项。
- 给出"STM32 工程移植到 GD32"的三步检查清单。

## 先修

- [G1 RCU 时钟树](01-rcu-clock.md)、[G2 GPIO](02-gpio-af.md)、[G3 USART](03-usart.md)。

## 先跑起来（10 分钟 quick win）

打开 `gd32f4xx.h`，搜索 `USBHS`/`EXMC`/`CAN`/`ENET`/`TRNG` 的基址定义——存在即有这个外设，搜不到即没有（或叫别的名字）。这是"有没有"的最快自查法。

## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| 有没有对照表 | GD32 vs STM32 外设存在性全表 | 配置 |
| USBHS 替代 OTG | 高速 USB 的方案差异 | 库解析 |
| EXMC 替代 FSMC | 外部存储器控制器的命名与功能差异 | 库解析 |
| CAN/ENET/SDIO | 两者都有但有差异的外设 | 库解析 |
| TRNG 等独有 | GD32 独有外设简介 | 配置 |
| 移植三步清单 | 存在性→寄存器→引脚 | 代码分析 |

## 一、有没有对照表：GD32F4xx vs STM32F407

| 外设 | STM32F407 | GD32F4xx | 差异类型 |
|---|---|---|---|
| GPIO | A~I（9 组） | A~I（9 组） | 命名不同（G2），数量同 |
| USART/UART | 6 个（USART1/2/3/6 + UART4/5） | **8 个**（USART0/1/2/5 + UART3/4/6/7） | GD32 多 3 个（G3） |
| SPI | 3 个（SPI1/2/3） | 3 个（SPI0/1/2） | 编号差 1，数量同 |
| I2C | 3 个（I2C1/2/3） | 3 个（I2C0/1/2） | 编号差 1，数量同 |
| TIM | 14 个（TIM1~14） | 14 个（TIMER0~13） | 命名 TIM→TIMER，数量同 |
| ADC | 3 个（ADC1/2/3） | 3 个（ADC0/1/2） | 编号差 1，数量同 |
| DAC | 2 通道（DAC1/2） | 2 通道（DAC0/1） | 编号差 1，数量同 |
| DMA | 2 个（DMA1/2） | 2 个（DMA0/1） | 编号差 1，数量同 |
| **USB** | OTG_FS + OTG_HS | **USBHS**（替代 OTG_HS） | 方案不同 |
| **EXMC** | FSMC（外部存储器） | **EXMC**（改名） | 命名不同，功能类似 |
| CAN | 2 个（CAN1/2） | 2 个（CAN0/1） | 编号差 1，可能有位差异 |
| ENET | 有（以太网 MAC） | 有（ENET） | 两者都有，命名已核验（见第四节） |
| SDIO | 有 | 有（SDIO） | 两者都有，命名已核验（见第四节） |
| **TRNG** | **无** | **有**（真随机数发生器） | GD32 独有 |
| RTC | 有 | 有 | 命名同；寄存器布局与 STM32 同构（TIME/DATE/CTL/STAT/PSC/WUT/ALRM0TD，gd32f4xx_rtc.h:45-55），细节已按头文件核验 |
| WDT/WWDT | 有 | 有（FWDGT/WWDGT） | 命名改 WDT→WDGT |

三条结论：

1. **GD32 编号从 0 起**：几乎所有外设编号比 STM32 小 1（SPI1→SPI0、TIM1→TIMER0）——G3 已见的 USART 模式是全系列通用规律。
2. **GD32 多 USBHS + TRNG**：STM32F407 的 OTG_HS 在 GD32 换成 USBHS（方案不同），TRNG 是 GD32 独有。
3. **命名风格统一**：GD32 所有控制寄存器叫 CTL（G3 已见），看门狗叫 WDGT（Watchdog Timer 加 T），FSMC 叫 EXMC——统一加长命名。

## 二、USBHS 替代 OTG：高速 USB 的方案差异

STM32F407 用 **OTG_FS + OTG_HS**（On-The-Go 全速+高速 USB），GD32F4xx 用 **USBHS**（USB High Speed）——两者都支持高速 USB（480Mbps），但实现方案与寄存器布局不同：

| 维度 | STM32F407 OTG_HS | GD32F4xx USBHS |
|---|---|---|
| 命名 | OTG_HS（OTG 兼容） | USBHS（专用高速） |
| 寄存器前缀 | OTG_HS_ | USBHS_ |
| OTG 模式 | 支持（主机/设备双模） | 有（V3.3.3 库含 device 与 host 双栈，`drv_usb_dev.h`/`drv_usb_host.h`） |
| ULPI 接口 | 有（外接 ULPI PHY 跑高速） | 有（ULPI，引脚分配待 UM 核验） |

迁移含义：STM32 的 USB 代码（OTG_HS 驱动）不能直接套 GD32——寄存器名与方案都不同。GD32 有自己的 USBHS 库（V3.3.3 为 `GD32F4xx_usb_library`，寄存器宏在 `driver/Include/drv_usb_regs.h`，不再叫 `gd32f4xx_usbhs.h`），移植要换库。

> **【注】** USBHS 与 OTG_HS 的具体位级差异、ULPI 引脚分配——以 `GD32F4xx_usb_library/driver/drv_usb_regs.h` 与用户手册为准；**OTG 双模已由官方库 host+device 双层证据背书（V3.3.3）**，ULPI 引脚仍待 UM 核验。

## 三、EXMC 替代 FSMC：外部存储器控制器的改名

STM32F407 叫 **FSMC**（Flexible Static Memory Controller），GD32F4xx 叫 **EXMC**（External Memory Controller）——功能类似（驱动 SRAM/NOR/PSRAM/NAND/SDRAM），命名与寄存器布局有差异：

| 维度 | STM32F407 FSMC | GD32F4xx EXMC |
|---|---|---|
| 命名 | FSMC | EXMC |
| 寄存器前缀 | FSMC_ | EXMC_ |
| SDRAM 支持 | 有（Bank 5/6） | 有（2 个 SDRAM 设备：SDCTL0/1，gd32f4xx_exmc.h:264） |
| NOR/PSRAM | 有（Bank 1 四区） | 有（EXMC_NOR_PSRAM 映射区） |
| NAND | 有（Bank 2/3） | 有（NAND/PC card 3 组：NPCTL1/2/3，gd32f4xx_exmc.h:203） |

迁移含义：FSMC 的寄存器名（FSMC_BCR/FSMC_BTR 等）在 GD32 换成 EXMC 前缀，功能映射类似但位级布局可能不同。移植时按偏移对照，别按名字。

> **【注】** EXMC 的 bank 分区与时序寄存器位级以 `gd32f4xx_exmc.h`（V3.3.3，本地 .trellis/ref/gd32/fw）为准：NOR/PSRAM、NAND/PC card、SDRAM 三段映射清晰，位级对照已核验；SDRAM 为 2 设备（SDCTL0/1），NAND/PC 为 3 组寄存器。

## 四、CAN/ENET/SDIO：两者都有但有差异

三个外设 STM32F407 与 GD32F4xx 都有，寄存器命名已按 V3.3.3 头文件核验（CTL 风格统一），位级细节仍待 UM：

| 外设 | STM32F407 | GD32F4xx | 已知差异 |
|---|---|---|---|
| CAN | bxCAN（CAN1/2） | CAN（CAN0/1） | 编号差 1；寄存器名 CR→CTL（CAN_CTL@0x00，gd32f4xx_can.h:46），其余 CTL/STAT/TSTAT/RFIFO/INTEN/BT 布局同方向；位级细节待 UM 核验 |
| ENET | 以太网 MAC | ENET | 命名同方向；MAC 寄存器（MAC_CFG/FRMF/H_LH/PHY_CTL）与 DMA 寄存器（含描述符格式位 DFM，gd32f4xx_enet.h:180-188,431）同构；DMA 描述符差异待 UM 核验 |
| SDIO | SDIO | SDIO | 命名同；寄存器名改 CTL 风格（PWRCTL/CLKCTL/CMDCTL，gd32f4xx_sdio.h:44-47）；时钟分频位级待 UM 核验 |

这三个外设的移植策略：**功能存在性确认后，逐个寄存器按偏移对照**。CAN 的 CR1→CTL0 命名迁移同 G3 USART 的规律（GD32 统一 CTL 命名）。

## 五、TRNG 等独有：GD32 独有外设

GD32F4xx 有而 STM32F407 没有的外设：

- **TRNG**（True Random Number Generator）：真随机数发生器，用噪声源生成真随机数——STM32F407 没有独立 TRNG（只有用 ADC 噪声的软件方案）。适合加密密钥生成。
- **USART5/UART6/7**：多 3 个串口（G3 已详述）。
- **可能的额外外设**：GD32F4xx 的某些子型号可能有 STM32 没有的外设——以具体型号 datasheet 为准。

TRNG 的存在让 GD32 在安全/加密场景比 STM32F407 多一个硬件基础——不用靠 ADC 噪声凑随机数，直接读 TRNG 寄存器出真随机。

## 六、移植三步清单：存在性 → 寄存器 → 引脚

把一个 STM32F407 工程移植到 GD32F4xx，三步检查：

1. **存在性检查**：扫工程用到的外设（GPIO/USART/SPI/USB/...），逐个查第一节"有没有"表——GD32 没有的要换方案（如 OTG_HS→USBHS），GD32 多的可利用（如 TRNG）。
2. **寄存器映射检查**：对存在的外设，逐个查寄存器命名（CR→CTL、BRR→BAUD）与偏移——按偏移不按名字（G3 纪律）。位级差异以 `gd32f4xx_*.h` 头文件为准。
3. **引脚分配检查**：查 GD32F4xx datasheet 的引脚复用表——GD32 的 AF 编号可能与 STM32 不同（G2 已见），同一功能可能在不同引脚。

三步走完，移植的"大坑"基本扫清。剩下的细节（时钟树、电压档、Flash 等待）在 G1 已述。

## 记忆锚点

::: tip 一句话记住
**GD32 编号从 0 起，USBHS 替代 OTG，EXMC 替代 FSMC，TRNG 是独有；移植三步：有没有→一不一样→引脚在哪。**
:::

## 实物实验

- 在 `code/gd32/01-rcu-clock` 工程基础上，尝试加一个 USART0 初始化（G3 的命名翻译）+ 一个 CAN0 初始化（CR→CTL0 迁移）——验证"按偏移不按名字"的移植纪律。

## 常见坑

- **按 STM32 外设名找 GD32**：FSMC 在 GD32 叫 EXMC，OTG_HS 叫 USBHS——名字不同，搜不到以为"没有"。
- **编号差 1 忘换**：STM32 SPI1 → GD32 SPI0、TIM1 → TIMER0——编号不换基址全错。
- **USB 方案直接套代码**：STM32 的 OTG_HS 驱动不能直接套 GD32 USBHS——方案不同，要换库。
- **TRNG 当 ADC 噪声用**：GD32 有真 TRNG，别再用 ADC 噪声凑随机数——硬件 TRNG 更安全更快。
- **引脚复用号不查 GD32 表**：GD32 的 AF 编号可能与 STM32 不同（G2 已见），同一功能可能在不同引脚——查 GD32 datasheet，别套 STM32 引脚表。

## 短自测

1. GD32F4xx 有而 STM32F407 没有的外设有哪几个？
<details><summary>看答案</summary>TRNG（真随机数发生器）+ USART5/UART6/7（多 3 个串口，G3 已详述）。TRNG 让 GD32 在加密场景多一个硬件基础，不用靠 ADC 噪声凑随机数。</details>

2. STM32 的 FSMC 在 GD32 里叫什么？OTG_HS 呢？
<details><summary>看答案</summary>FSMC → EXMC（External Memory Controller）；OTG_HS → USBHS（USB High Speed）。两者功能类似（驱动外部存储器/高速 USB），但命名与寄存器布局不同，移植要换库、按偏移对照。</details>

3. GD32 的外设编号与 STM32 有什么规律性差异？举三例。
<details><summary>看答案</summary>GD32 几乎所有外设编号从 0 起（比 STM32 小 1）：SPI1→SPI0、TIM1→TIMER0、USART1→USART0、ADC1→ADC0、CAN1→CAN0、DMA1→DMA0。迁移时别按 STM32 编号找 GD32 基址。</details>

4. 把一个 STM32F407 工程移植到 GD32F4xx，三步检查是什么？
<details><summary>看答案</summary>①存在性检查：扫工程用到的外设，查"有没有"表——GD32 没有的换方案（OTG→USBHS），GD32 多的可利用（TRNG）。②寄存器映射检查：对存在的外设查命名（CR→CTL、BRR→BAUD）与偏移，按偏移不按名字，位级以头文件为准。③引脚分配检查：查 GD32 datasheet 的引脚复用表，AF 编号可能不同，同一功能可能在不同引脚。</details>

5. GD32 的 TRNG 相比 STM32F407 的随机数方案有什么优势？
<details><summary>看答案</summary>STM32F407 没有独立 TRNG，要用 ADC 噪声做软件随机数方案（质量差、有偏、慢）。GD32 有硬件 TRNG（真随机数发生器），用物理噪声源生成真随机数——质量高、无偏、快，适合加密密钥生成。移植时把 STM32 的 ADC 噪声随机数方案换成 GD32 TRNG 直接读。</details>

## 对照表：本章概念 → 仓库与上游落点

| 概念 | 落点 |
|---|---|
| 外设存在性对照表 | 本章第一节；`gd32f4xx.h` 基址定义 |
| USBHS 替代 OTG_HS | `GD32F4xx_usb_library/driver/Include/drv_usb_regs.h`（V3.3.3，本地已缓存并核验：device+host 双栈） |
| EXMC 替代 FSMC | `gd32f4xx_exmc.h`（V3.3.3，本地已缓存并核验：NOR/PSRAM、NAND/PC card、SDRAM 三段映射） |
| 编号差 1 规律 | [G3 USART](03-usart.md) USART0 vs USART1；[G2 GPIO](02-gpio-af.md) |
| 移植三步清单 | 本章第六节；[G1 RCU](01-rcu-clock.md) 时钟树差异 |
| STM32 对照锚点 | [S3 GPIO](../stm32/03-gpio.md)、[S7 USART](../stm32/07-usart.md) |
| 命名风格 CTL 统一 | [G3 USART](03-usart.md) CR→CTL；[S15 SPL 解剖](../stm32/15-spl-anatomy.md) 读库姿势 |

## 你做到了

- GD32F4xx 与 STM32F407 的外设差异在你眼里是一张可查的表；
- 移植三步清单到手——换任何国产 MCU（如 HK32/CH32/AT32）都能按这套方法建档。

<div class="achievement">
✅ G 篇收官。下一站：<a href="../rtos/rtthread/00-arch.html">R 篇 RT-Thread</a>——国产内核+国产操作系统的组合；或直接进 <a href="05-riscv-toolchain.html">V 篇 RISC-V</a>——GD32VF103 的 Bumblebee 内核，没有 NVIC 的世界。
</div>

> AI生成