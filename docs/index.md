---
layout: home

hero:
  name: 通往单片机之路
  text: 把一颗芯片讲透
  tagline: 寄存器级 STM32F407 × ESP32-S3 双路线 · C 语言精髓 · RTOS 双精讲 · 全程实物实验
  actions:
    - theme: brand
      text: 开始学习
      link: /guide/
    - theme: alt
      text: 路线图
      link: /guide/#全景路线图

features:
  - icon: 💡
    title: STM32F407 寄存器主线
    details: 野火霸天虎板上，从 RCC 时钟到 GPIO 七个寄存器，手写每一行启动代码，点亮的不是灯，是对芯片的理解。
    link: /stm32/
    linkText: 进入路线
  - icon: 📡
    title: ESP32-S3 + ESP-IDF
    details: 立创实战派 S3 板上，从 GPIO Matrix 到 Wi-Fi 状态机到音频链路，把"小智"的看家本领拆给你看。
    link: /esp32/
    linkText: 进入路线
  - icon: 🧠
    title: C 语言精髓
    details: 为什么 *(volatile uint32_t *)0x40020014 能点灯？指针、volatile、ABI、栈帧——嵌入式 C 是另一种 C。
    link: /c/
    linkText: 进入路线
  - icon: ⚙️
    title: 构建与运行全过程
    details: 预处理到链接四步开盒、ELF 解剖、链接脚本逐行、上电到 main 的每一条指令——你的代码经历了什么。
    link: /build/
    linkText: 进入路线
  - icon: 🧵
    title: RTOS 双精讲
    details: FreeRTOS 内核源码级剖析 + RT-Thread 设备框架与生态，上下文切换动画演示，双 OS 对照选型。
    link: /rtos/
    linkText: 进入路线
  - icon: 🔁
    title: GD32 双系对照（建设中）
    details: G 篇 GD32F4xx（Cortex-M4，RCU/200MHz）逐字段对剖 STM32F407；V 篇 GD32VF103（RISC-V Bumblebee）丈量 CLIC 与 MTIME。
    link: /gd32/
    linkText: 看看规划
  - icon: 🔬
    title: 实物实验中心
    details: 逻辑分析仪抓 UART、示波器看 PWM、优先级反转复现——眼见为实，每章都有能上手的实验。
    link: /lab/
    linkText: 进入实验
---

<div class="mcu-start">

## 先挑一条适合自己的路

同一个站点，四种上路方式——**先见现象，再挖原理**，别从最难的那章硬啃。

| 你是谁 | 前三步 | 然后 |
|---|---|---|
| 零基础，板子刚到手 | [S0 环境搭建](/stm32/00-env.md) 点亮第一盏灯 → [实验 E01](/lab/e01-blink.md) → [C1 内存模型](/c/01-memory-model.md) | 按 C 篇 → B 篇 → S 篇顺序补地基 |
| 会 C、玩过 Arduino | [B1 四步构建](/build/01-four-steps.md) → [B4 启动过程](/build/04-startup.md) → [S3 GPIO](/stm32/03-gpio.md) | 补上"构建/链接/启动"这块最常被跳过的地基 |
| 硬件出身，代码薄 | [C2 指针](/c/02-pointer.md) → [C3 volatile](/c/03-volatile.md) → [S2 RCC 时钟树](/stm32/02-rcc-clock.md) | 每章配 [实验中心](/lab/index.md) 的观测点，眼见为实 |
| 想做 AIoT / 语音产品 | [P0 ESP-IDF 环境](/esp32/00-env.md) → [P2 GPIO 矩阵](/esp32/02-gpio-matrix.md) → [P5 UART 驱动](/esp32/05-uart-driver.md) | 直上 [E07 姿态传感器](/lab/e07-qmi8658.md)、[E08 音频放音](/lab/e08-audio-play.md) |
| 被 RTOS 面试/项目卡住 | [F1 任务与 TCB](/rtos/freertos/01-task-tcb.md) → [F2 上下文切换](/rtos/freertos/02-context-switch.md) → [实验 E04 优先级反转](/lab/e04-priority-inversion.md) | 回看 [双 OS 对照](/rtos/compare/00-side-by-side.md) 做选型 |

## 学习地图

下图的成稿数、动画数、实验数、工程数由 `npm run docs:gen` 扫全站章节 frontmatter 算出，不手写。**实心=成稿可读，虚线=骨架建设中**（结构、目标、先修都已定，正文待补）。

<LearningMap />

> 每章同一个循环：**手册 → 寄存器 → 库源码 → 实物**。看不懂的那一环，就是该回去补的那一环。

</div>

