---
title: 导读·实物装备清单
---

# 实物装备清单：照着买，不花冤枉钱

> 🎯 嵌入式学习有一条铁律：**手上没有硬件，看懂的都是假懂**。好消息是全套装备不超一顿火锅钱；坏消息是买错一件就要等三天快递。本页照单抓药。

## 核心两块板（作者实持，全站实验按它们写）

| 板卡 | 角色 | 关键配置 | 用在哪 |
|---|---|---|---|
| [野火 STM32F407 霸天虎](https://doc.embedfire.com/products/link/zh/latest/mcu/stm32/stm32f407_batianhu.html) | STM32 主线 | F407ZGT6：168MHz、1MB Flash、192KB RAM；RGB 灯 PF6/7/8 | [S 篇](../stm32/index.md) 全部 + RTOS 移植 |
| [立创·实战派 ESP32-S3](https://wiki.lckfb.com/zh-hans/szpi-esp32s3/)（小智板） | ESP32 主线 | N16R8：LX7 双核 240MHz、16MB Flash、8MB PSRAM；2 寸屏/双麦/喇叭/姿态传感器 | [P 篇](../esp32/index.md) 全部 |
| 2.8 寸 ESP32-S3 显示模块（ES3C28P，[LCD wiki 资料](https://www.lcdwiki.com/zh/2.8inch_ESP32-S3_Display)） | ESP32 当前持板 | N16R8 同款主控；ILI9341V 2.8 寸屏（SPI：CS=IO10/DC=IO46/SCK=IO12）；FT6336G 触摸（I2C=IO15/16，INT=IO17 低有效）；ES8311 音频；WS2812 RGB=IO42；SD=SDIO；电池 ADC=IO9 | [P 篇](../esp32/index.md) 实验（触摸/屏/音频场景） |

::: warning 买板注意
霸天虎**不板载仿真器**，必须另购调试器（见下表）。立创 S3 板与 ES3C28P 均为 Type-C 一线通吃（供电+烧录+串口），无此问题。两块 S3 板都是 N16R8 小智系（16MB Flash + 8MB PSRAM），P 篇正文通用；差异在板载外设——实战派带姿态传感器 QMI8658（[E07](../lab/e07-qmi8658.md)），ES3C28P 带电容触摸与 2.8 寸方屏（FT6336G/ILI9341V）。引脚以各板资料页为准，上板前先核。
:::

## 必配工具

| 装备 | 参考价 | 用途 | 用在哪 |
|---|---|---|---|
| ST-Link V2（或 J-Link EDU/DAPLink） | ¥20–80 | 霸天虎的烧录+调试 | [S0](../stm32/00-env.md) 起每章 |
| USB 转 TTL 串口模块（CH340/CP2102） | ¥8 | 霸天虎 printf 输出 | [S7 USART](../stm32/07-usart.md) 起 |
| 24MHz 8 通道逻辑分析仪（saleae 兼容） | ¥30–60 | 抓 UART/I2C/SPI 波形 | [E02](../lab/e02-logic-uart.md)、[E05](../lab/e05-i2c-eeprom.md)、S6/S11/S12 |
| Micro-USB 数据线 ×2 + Type-C 数据线 ×1 | ¥15 | 供电与连接 | 全程 |
| 杜邦线一排 + 面包板一块 | ¥10 | 外接实验电路 | S9 ADC、S11 I2C 起 |

## 选配（学到再买）

| 装备 | 什么时候需要 |
|---|---|
| 示波器（100MHz 入门即可） | [E03 PWM 波形](../lab/e03-scope-pwm.md)、[S10 DAC 正弦](../stm32/10-dac.md)；逻辑分析仪能看方波，看不了模拟量 |
| 万用表 | [S14 功耗实测](../stm32/14-pwr.md)、[E06 电流](../lab/e06-lowpower-current.md)；排查供电也好用 |
| 电位器 + 光敏电阻 + 有源蜂鸣器 | [S9 ADC](../stm32/09-adc.md) 模拟量实验 |
| SSD1306 OLED（I2C 接口） | [S11 I2C](../stm32/11-i2c.md) 扩展实验（S3 板自带屏，不需要） |

## 软件全部免费

- STM32 侧：Arm GNU Toolchain + make + OpenOCD + VSCode（[S0](../stm32/00-env.md) 手把手装）
- ESP32 侧：ESP-IDF v5.5.x 官方安装器（[P0](../esp32/00-env.md)）
- 上位机：PulseView（逻辑分析仪配套，开源免费）、串口助手任选

## 记忆锚点

::: tip 一句话记住
**两块板 + 三件套（仿真器、串口、逻辑分析仪）就能走完全站**；示波器和万用表是进阶 DLC，学到再买不迟。
:::

## 常见坑

- **数据线变充电线**：只能供电不能通信，症状是插上去设备管理器毫无反应。换线先试。
- **便宜 ST-Link 固件太旧**：个别国产 V2 克隆需要升级固件才能被新 OpenOCD 识别，买评价里"OpenOCD 可用"的。
- **逻辑分析仪别买 8 通道以下的**：SPI 全双工 + 片选就要 4 根线，8 通道是底线。

## 你做到了

- 一张不花冤枉钱的购物清单到手；
- 知道每件装备在路线图的哪个位置等你。

> AI生成