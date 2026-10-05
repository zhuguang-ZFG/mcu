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
  - icon: 🔬
    title: 实物实验中心
    details: 逻辑分析仪抓 UART、示波器看 PWM、优先级反转复现——眼见为实，每章都有能上手的实验。
    link: /lab/
    linkText: 进入实验
---
