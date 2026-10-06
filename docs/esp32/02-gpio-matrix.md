---
title: P2 GPIO 与引脚矩阵：引脚自由换岗的秘密
---

# P2 GPIO 与引脚矩阵：引脚自由换岗的秘密

> 🎯 STM32 上 USART1_TX 永远长在 PA9（或复用表给的固定备选）；ESP32-S3 上你可以对 UART 说"TX 去 GPIO10，RX 去 GPIO11"——**外设信号通过 GPIO Matrix 自由换岗**，就像公司总机把电话转到任意工位。但"任意"有前提：工位得存在、没被占用、接得通。

## 本章精髓

1. **两条路进引脚**：**IO_MUX**（直连快车道：信号↔固定引脚，延迟低，少数高速信号必须走它）与 **GPIO Matrix**（交换矩阵：外设信号↔任意有效引脚，灵活但多一级延迟）——选型 = 速度 vs 布局自由。
2. **"任意引脚"的真实含义**：任意 **有效焊盘 + 该脚支持的输入/输出能力 + 模组没占用 + 板卡实际接出来** 的引脚。S3 芯片有 45 个物理 GPIO（0~21、26~48），但 N16R8 模组的 FLASH+PSRAM 占掉 12 个（八线 PSRAM 占 IO35/36/37 一带），板上真正引出来的更少——立创实战派的多功能扩展口只引出 **GPIO10、GPIO11**。
3. **焊盘属性是独立一维**：上下拉/驱动强度/开漏/毛刺过滤（S3 新增）——与路由无关，`gpio_set_pull_mode` 家族管这片；路由对了但方向没配，信号照样出不来。

## 怎么读这一章

- **能记住**：口诀"IO_MUX 是专线，Matrix 是总机；高速走专线，布局走总机；上下拉驱动找焊盘，strapping 脚上电别惹。"
- **能理解**：为什么"任意映射"不等于"随便用"；为什么 PSRAM 占用的脚一碰就崩。
- **能用**：用 `uart_set_pin` / LEDC 的 `gpio_num` 把信号在两个扩展口脚之间换岗，并用仪器确认。

## 学习目标

- 说出 IO_MUX 与 GPIO Matrix 的差异、各自代价，以及哪些信号必须走 IO_MUX。
- 用 IDF API 把一路信号分配到两个不同引脚并实测。
- 解释 strapping 引脚（GPIO0/45/46）与普通 GPIO 的"上电角色冲突"，设计时如何避让。

## 先修

- [P1 架构](01-arch-boot.md)；[S3 STM32 GPIO](../stm32/03-gpio.md)（复用概念对照）。

## 先跑起来（10 分钟 quick win）

`code/esp32/01-gpio-matrix`：同一个 LEDC PWM 信号，先在 GPIO10 上出波形，三秒后换到 GPIO11——程序不动、波形换脚。再用 `uart_set_pin` 把 UART1 换到扩展口两个脚（见 [P5](05-uart-driver.md) 的 `02-uart-events`）。

## 动画：信号怎么走到焊盘

外设信号出发 → 到交换矩阵 → 选一个有效焊盘 → 焊盘属性（方向/上下拉）生效。盯住"被占用的脚"那一栏：PSRAM 占用的 IO35~37 直接打叉——驱动不拦你（它只查焊盘合法性），失败发生在物理层：波形出不来，还会干扰 PSRAM 总线；若固件使能了 octal PSRAM，可能当场跑飞。

![GPIO 矩阵路由动画](/anim/gpio-matrix-routing.svg)

## 板卡与版本前提

- 板卡：立创·实战派 ESP32-S3（模组 ESP32-S3-WROOM-1-N16R8，FLASH 16MB + PSRAM 8MB）。
- 板上用户可自由使用的引脚（立创 wiki 核实）：**BOOT 键 = GPIO0**（输入）、**多功能扩展口 = GPIO10、GPIO11**；I2C 扩展口与板载传感器共用（只能当 I2C 用）。
- **IO35/36/37 被八线 PSRAM 占用，不可用**；IO46 下载模式必须低电平（板上有下拉电阻）。
- 框架：ESP-IDF **v5.5.2**（本机实测版本，读 `esp_idf_version.h` 确认）。

## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| 一、两条路由 | IO_MUX vs Matrix 结构图与延迟差 | 配置 |
| 二、输出路由 | 信号源枚举 + 引脚选择 | 库解析 |
| 三、输入路由 | 反向路由与"一信号多听" | 库解析 |
| 四、焊盘属性 | 上下拉/驱动/开漏/毛刺过滤 | 配置 |
| 五、strapping 避让 | 上电采样脚清单与设计禁忌 | 引脚 |
| 六、代码分析 | `01-gpio-matrix/main.c` 的换岗全链路 | 代码分析 |

## 一、两条路由：专线 vs 总机

外设信号到引脚有两条路：

- **IO_MUX**：信号直接绑到固定引脚，中间不过交换矩阵——延迟低、时序干净。SPI 高速模式等场合必须走它，这也是"某些脚是某外设的'原生脚'"的来源。
- **GPIO Matrix**：信号先进交换矩阵，再路由到任意有效引脚——灵活，代价是多一级延迟。

STM32 的 AF 复用表相当于"只有专线、可选工位有限"；S3 的 Matrix 相当于"总机可转任意工位"。代价对照：**Matrix 多一级延迟，高速信号走 IO_MUX**。

## 二、输出路由：信号源选外设，引脚选目的地

输出的路由方向是"外设 → Matrix → 引脚"。IDF 里你通常不直接写 Matrix 寄存器，而是用外设驱动的引脚参数——比如 LEDC 的 `gpio_num`、`uart_set_pin` 的 TX/RX。驱动内部帮你把信号路由过去。

要点：路由成功后**焊盘方向仍要单独配**（输出使能是独立一步）——驱动一般会帮你做，但手写 Matrix 路由时这是最容易漏的一步。

## 三、输入路由：反向路由与"一信号多听"

输入方向相反：引脚信号 → Matrix → 外设输入。Matrix 的一个特性是**一个引脚信号可以同时喂给多个外设输入**——比如把一根线同时接进 UART RX 和 RMT 的输入做协议分析。这是 STM32 的 AF 复用做不到的。

## 四、焊盘属性：与路由无关的另一维

上下拉、驱动强度、开漏、毛刺过滤（S3 新增）都由焊盘电路管，与信号路由完全独立。所以配置顺序是两条线并行：

- 路由线：`uart_set_pin` / `ledc_channel_config`（信号去哪）
- 焊盘线：`gpio_set_pull_mode` / `gpio_set_drive_capability`（脚的电气属性）

## 五、strapping 避让：上电那一拍的角色

GPIO0（BOOT）、GPIO45、GPIO46 等在上电/复位时被采样，决定启动模式。**上电瞬间这些脚不是普通 GPIO**——外接上拉/下拉错了，板子每次上电都进下载模式。本板的 IO46 已经板载下拉电阻（保证下载模式安全）；你要用的是 GPIO0（BOOT 键）时记住它默认上拉、按下为低。

## 六、代码分析：`01-gpio-matrix/main.c`

- `ledc_channel_config(.gpio_num = PAD_A)`：LEDC 通道绑到 GPIO10；
- `ledc_set_pin(PAD_B, ...)`：三秒后同一信号换到 GPIO11——**Matrix 重新路由，程序其余部分不动**；
- `ledc_set_pin(GPIO_NUM_35, ...)`：往 PSRAM 占用的脚上路由——驱动返回 0（ledc.c:827 只查 `GPIO_IS_VALID_OUTPUT_GPIO`），但物理上失败；"任意引脚"的边界当场可见；
- `SOC_LEDC_CHANNEL_NUM` / `SOC_LEDC_TIMER_BIT_WIDTH` 打印：芯片能力以 `soc_caps.h` 为准，不是凭印象。

## 附录：工程完整源码

<<< ../../code/esp32/01-gpio-matrix/main/main.c

## 记忆锚点

::: tip 一句话记住
**IO_MUX 是专线，Matrix 是总机；高速走专线，布局走总机；"任意"= 有效焊盘 + 没被占用 + 板卡接出来；strapping 脚上电别惹。**
:::

## 实物实验

- quick win 的 PWM 换岗：示波器/逻辑分析仪先夹 GPIO10，三秒后波形消失、出现在 GPIO11；
- 翻车实验：把信号路由到 IO35（PSRAM 占用），记录驱动的返回值与现象；
- "一信号多听"（选做）：UART TX 同时路由给 UART RX 与另一外设输入，两路分析仪通道对照。

## 常见坑

- **strapping 脚当普通 IO**：GPIO0（BOOT）上拉电阻接错，板子每次上电进下载模式；
- **Flash/PSRAM 占用脚乱动**：八线 PSRAM 占用 IO35/36/37 一带，一碰就崩；
- **Matrix 路由后忘配焊盘方向**：信号路由对了，引脚还是输入态——输出使能是独立一步；
- **USB D+/D- 脚（GPIO19/20）当 GPIO**：用原生 USB 时这两脚有主——冲突外设先让位；
- **把"任意引脚"当"随便哪个脚"**：模组占用脚、strapping 脚、没引出的脚都不在内。

## 短自测

1. IO_MUX 和 GPIO Matrix 的区别是什么？什么信号必须走 IO_MUX？
<details><summary>参考答案</summary>IO_MUX 是信号到固定引脚的直连（延迟低、时序干净）；GPIO Matrix 是交换矩阵（外设信号路由到任意有效引脚，多一级延迟）。高速信号（如部分 SPI 模式）必须走 IO_MUX。</details>

2. S3 上"任意引脚"的真实前提是什么？
<details><summary>参考答案</summary>四个条件同时成立：引脚是有效焊盘（S3 有 45 个物理 GPIO）；该脚支持你要的方向/能力；模组没占用（FLASH/PSRAM 占 12 个，N16R8 的八线 PSRAM 占 IO35~37）；板卡把它实际引出来了。</details>

3. 为什么 strapping 引脚不能随便接上拉/下拉？
<details><summary>参考答案</summary>上电/复位瞬间这些脚被采样以决定启动模式，不是普通 GPIO。上拉/下拉接错了，板子每次上电都进下载模式或起不来。</details>

## 对照表：本章概念 → 仓库与上游落点

| 概念 | 落点 |
|---|---|
| IO_MUX vs Matrix | ESP-IDF GPIO 文档（v5.5.2）+ TRM |
| 芯片能力宏 | `components/soc/esp32s3/include/soc/soc_caps.h` |
| 板卡引脚分配 | 立创 wiki（GPIO0=BOOT、GPIO10/11=扩展口、IO35~37=PSRAM） |
| 换岗实验 | [code/esp32/01-gpio-matrix](https://github.com/zhuguang-ZFG/mcu/tree/main/code/esp32/01-gpio-matrix) |
| 动画 | [gpio-matrix-routing.svg](/anim/gpio-matrix-routing.svg) |

## 你做到了

- "引脚自由"从宣传语变成可配可测的机制；
- S/P 两篇的 GPIO 观完成对照：固定 AF 表 vs 自由矩阵，各有设计哲学；
- "任意引脚"的四个前提，你以后不会再被宣传语带偏。

<div class="achievement">
✅ 下一站：<a href="03-idf-anatomy.html">P3 IDF 工程解剖</a>——组件化 CMake 与 Kconfig 的流水线全拆。
</div>