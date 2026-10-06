---
title: R4 设备框架：驱动与应用的解耦术
status: building
difficulty: 2
minutes: 30
---

# R4 设备框架：RT-Thread 最灵魂的一章

> 🎯 裸机写应用，`uart_send()` 里全是寄存器；换块板子，应用层推倒重来。设备框架说：应用只跟"设备句柄"说话——`rt_device_open/read/write`，底下是 USART1 还是 UART5，应用不关心。**这就是驱动与应用解耦**，也是 RT-Thread 区别于"裸内核"的核心资产。

## 本章精髓

1. 设备=对象+操作表：`struct rt_device` 继承对象头，挂一张 ops 表（init/open/close/read/write/control）——驱动作者实现这张表，应用作者按统一 API 调用（与 Linux 字符设备的 file_operations 一脉相承）。
2. 注册与查找两分离：驱动 `rt_device_register(dev, "uart1")` 挂进对象容器；应用 `rt_device_find("uart1")` 按名取柄——**名字是接口，实现可替换**。
3. 框架之上的"设备类型"再封装：PIN（GPIO）、UART（串口带缓冲/回调）、I2C/SPI bus——越往上层，应用越无感；finsh 的 `list_device` 一屏看全家。

## 学习目标

- 画出"应用→rt_device API→ops 表→驱动→寄存器"的调用链，并标注每层归属（框架/驱动/BSP）。
- 用 PIN 设备点灯：rt_pin_mode/rt_pin_write，对照 [S3](../../stm32/03-gpio.md) 的手写版谈封装得失。
- 用 UART 设备（中断接收+回调）实现串口回显，与 S7 手写版/F4 队列版三方对照。

## 先修

- [R0 对象模型](00-arch.md)、[S7 USART](../../stm32/07-usart.md)、[F4 队列](../freertos/04-queue.md)。

## 先跑起来（10 分钟 quick win）

标准版工程上 `list_device` 找到 "pin"，三行代码点 RGB 灯：

```c
rt_pin_mode(LED_R, PIN_MODE_OUTPUT);
rt_pin_write(LED_R, PIN_LOW);   /* 共阳：低电平亮 */
```

不用查任何一个寄存器——体会封装的甜。

## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| 调用链全图 | 应用/框架/驱动/寄存器四层解剖 | 库解析 |
| rt_device 解剖 | ops 表逐字段；register/find/open 源码路径 | 库解析 |
| PIN 设备 | 编号体系（GET_PIN 宏）；点灯对照实验 | 配置 |
| UART 设备 | 接收回调+缓冲模型；与手写环形缓冲对照 | 代码分析 |
| I2C/SPI bus | 总线设备与"挂在总线上的从设备"两级模型 | 配置 |
| 自己写一个设备 | 把蜂鸣器封装成 rt_device 的全流程 | 代码分析 |

## 记忆锚点

::: tip 一句话记住
**驱动填表（ops），应用喊名（find），换板只换表，应用纹丝不动——解耦的代价是一张表，回报是整个生态。**
:::

## 实物实验

- PIN 设备点灯 vs [E01](../../lab/e01-blink.md) 寄存器版：同一块板两种世界观，GDB 里追一次 `rt_pin_write` 到 BSRR 的完整下钻——封装在你眼前逐层剥落。

## 常见坑

- **忘了 register 就 find**：设备不在容器里，find 返回空——驱动入口函数与 INIT_DEVICE_EXPORT 检查。
- **把设备名当字符串随便起**：命名是 BSP 与应用的契约（"uart1"/"i2c1" 惯例）——乱起名上层软件包找不到。
- **UART 回调里干重活**：回调在中断/线程上下文因配置而异——查清 RX indicate 的调用上下文再写代码。
- **绕过框架直接摸寄存器**：绕过框架=破坏解耦契约，除非性能论证（RT 路径），否则别拆自己家地基。

## 你做到了

- 驱动模型从"Linux 那套很高级"变成"我也写得出的 ops 表"；
- RT-Thread 的生态逻辑打通：软件包为什么能即插即用，答案就在这层框架。

<div class="achievement">
✅ 下一站：<a href="05-finsh.html">R5 finsh 控制台</a>——在板子上跑 shell：list、ps、help 的背后。
</div>
