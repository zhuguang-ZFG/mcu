---
title: P6 SPI/I2C 驱动框架：板载外设当教材
status: building
difficulty: 3
minutes: 50
---

# P6 SPI/I2C 驱动框架：拿 ST7789 与 QMI8658 当活教材

> 🎯 立创实战派 S3 板载一块 ST7789 彩屏（SPI）和一颗 QMI8658 姿态传感器（I2C）——学驱动框架最好的方式就是：**让屏幕亮起来，让姿态数据流出来**。本章用 IDF 的新版主机驱动框架（spi_master / i2c_master）打通这两件事。

## 本章精髓

1. 总线与设备两级模型：`spi_bus_config_t` 先配"哪条线"（MOSI/MISO/SCLK），`spi_device_interface_config_t` 再配"跟谁说话"（CS/速率/模式/队列深度）——总线可复用，设备可挂多个（与 [R4](../rtos/rtthread/04-device.md) 的总线模型异曲同工）。
2. 事务（transaction）是 SPI 的灵魂：`spi_transaction_t` 描述一次"命令+地址+数据"的完整交互，队列化异步执行——屏刷带宽就靠"队列里永远有事务在飞"。
3. 新 I2C 驱动的对象化：`i2c_new_master_bus` 出总线句柄，`i2c_master_bus_add_device` 出设备句柄，`i2c_master_transmit_receive` 一把梭"写寄存器地址+读数据"——对比 S11 的逐拍寄存器级，框架把"时序礼仪"全部代劳。

## 学习目标

- 按立创 wiki 原理图查出 ST7789/QMI8658 的 GPIO 分配并完成总线+设备两级配置（出处必标）。
- 点亮 ST7789：初始化序列→开窗→刷纯色，说出每个事务的命令/数据区分（DC 引脚的作用）。
- 读 QMI8658 的 WHO_AM_I 与六轴数据，串口以 10Hz 打印。

## 先修

- [S11 I2C](../stm32/11-i2c.md)、[S12 SPI](../stm32/12-spi.md)（硬件时序）、[P2 引脚](02-gpio-matrix.md)。

## 先跑起来（10 分钟 quick win）

I2C 先通：读 QMI8658 WHO_AM_I（寄存器 0x00），串口打印出期望的 ID 值——一次事务证明整条链路。

## 板卡事实

- 屏幕 ST7789（SPI，320×240）、触摸 FT6336（I2C）、姿态 QMI8658（I2C）、音频 ES8311/ES7210（I2C+I2S）；**全部 GPIO 分配与 I2C 地址以立创 wiki 原理图页为准（wiki.lckfb.com/zh-hans/szpi-esp32s3/）**，成稿时逐一核对标注。

## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| 两级模型 | 总线配置 vs 设备配置逐字段 | 配置 |
| SPI 事务 | transaction 结构与队列化；DC 线的 GPIO 角色 | 库解析 |
| ST7789 点亮 | 初始化序列逐条；开窗/写像素 DMA 路径 | 代码分析 |
| I2C 新驱动 | master_bus/device 句柄模型；transmit_receive 组合事务 | 库解析 |
| QMI8658 数据 | WHO_AM_I→量程配置→六轴读取→换算 | 代码分析 |
| 与 S 篇对照 | 手写时序 vs 框架事务：各自的适用场景 | 库解析 |

## 记忆锚点

::: tip 一句话记住
**先配线再认人（总线/设备两级），SPI 靠事务排队飞，I2C 一句 transmit_receive 走完礼仪；屏要 DC 分令数，传感器先问 WHO_AM_I。**
:::

## 实物实验

- [E07 读 QMI8658](../lab/e07-qmi8658.md)：摇板子看三轴数据跳变；
- ST7789 刷屏：纯色→色带→帧率粗测（改 SPI 时钟 40M/80M 对比）。

## 常见坑

- **SPI 模式配错**：ST7789 用 mode0/3（以屏手册为准），模式错白屏花屏。
- **CS 与 DC 搞反**：DC 是数据/命令选择不是片选——接线/配置错位症状为"全屏噪声"。
- **I2C 地址左移忘处理**：IDF 用 7 位地址（不左移）——手册给 8 位地址要先 >>1（S11 复训）。
- **事务缓冲用局部变量做异步传输**：函数返回后缓冲失效——异步事务的 buffer 生命周期必须覆盖传输期（C1 复训）。

## 你做到了

- 两块板载外设听你调遣：屏会亮，姿态会报数；
- 总线/设备/事务的框架语言成型——以后接任何 SPI/I2C 器件都是同一套流程。

<div class="achievement">
✅ 下一站：<a href="07-timer-ledc.html">P7 定时器与 LEDC</a>——GPTimer 和 LEDC 的分工，呼吸灯与背光调光。
</div>
