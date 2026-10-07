---
title: 动画演示中心
---

# 动画演示中心

把全站**机制动画**集中到一页：每一张都是构建期内联的 SMIL 动画，可播放/暂停、跟随深浅主题换色。只把图当"装饰"就辜负了它们——**动画本身就是结论**：读的时候看它怎么"动"，暂停在想不通的那一步。

> 每张动画一轮 8–18s，四个阶段循环。点播放/暂停，或直接看进度条走。下划线文字是给读屏和"关掉动效"读者看的完整因果，没在动也能看懂。

## 怎么看：三件武器

动画不是配图，是"把因果关系演给你看"。全站动画只用三件武器，看懂它们就懂所有图：

| 武器 | 长什么样 | 它在说什么 | 样板 |
|---|---|---|---|
| **爬线** | 波形/连线像被逻辑分析仪逐点抓出来 | 数据在**顺序流过**，不是瞬间出现 | [USART 帧](/stm32/07-usart.md)、[I2C 时序](/stm32/11-i2c.md) |
| **生长箭头** | 线条从发端插到收端 | 报文/指针"在路上"，到尖端才算抵达 | [TCP 握手](/esp32/08-wifi.md)、[上下文切换](/rtos/freertos/02-context-switch.md) |
| **节拍脉冲** | 一个点或灯按固定频率闪 | 某事"**重复发生**"，周期本身就是结论 | [volatile 访存](/c/03-volatile.md)、[SysTick](/stm32/05-systick.md) |
| **接力流转** | 一个对象沿路径持续移动 | 流程/接力在**持续进行**，不是快照 | [四步构建](/build/01-four-steps.md)、[ESP32 启动](/esp32/01-arch-boot.md) |

判断标准只有一条：**运动本身就是结论的一部分**——把动画停在任何一帧，画面都要能自己说话。

## 各板块动画

按板块分组陈列；每张图对应的正文章节在板块标题与图注里都能对上号，点导航栏对应板块即可回去接着读。

## C 语言精髓

![volatile 的访存合同：读一次 vs 每次读](/anim/volatile-as-if.svg)

![全局变量在 .bss/.data 的两地生活](/anim/memory-two-homes.svg)

![函数调用栈帧：压栈与弹栈](/anim/stack-frame.svg)

## 构建与运行全过程

![ELF 的两副目录：文件视图与段视图](/anim/elf-two-views.svg)

![上电到 main 的启动时序](/anim/boot-sequence.svg)

![B1 四步构建：main.c 到 blink.elf 的流水线](/anim/build-four-steps.svg)

## STM32F407 寄存器主线

![RCC 时钟树：168MHz 从哪来](/anim/rcc-clock-tree.svg)

![GPIO 配置流程：从寄存器到点亮](/anim/gpio-config.svg)

![总线矩阵：内核与外设怎么连](/anim/bus-matrix.svg)

![位带别名：位操作到字操作](/anim/bitband-alias.svg)

![中断现场入场：硬件压栈八字](/anim/irq-entry.svg)

![SysTick 倒数与 COUNTFLAG 读清](/anim/systick-tick.svg)

![USART 帧：逐位抓出来的波形](/anim/uart-frame.svg)

![USART TXE/TC 发送节拍](/anim/usart-txe-tc.svg)

![DMA 环形缓冲搬运](/anim/dma-circular-buffer.svg)

![DMA 双缓冲乒乓切换](/anim/dma-pingpong.svg)

![SAR 逐次逼近：12 轮二分](/anim/sar-successive.svg)

![I2C 时序：起始/停止/应答](/anim/i2c-timing.svg)

![SPI 时序：主从沿采样](/anim/spi-timing.svg)

![TIM PWM：计数器到占空比](/anim/tim-pwm-counter.svg)

![TIM 输入捕获：边沿定格](/anim/tim-input-capture.svg)

![HardFault 取证：故障升级与栈帧挖 PC](/anim/hardfault-forensics.svg)

## FreeRTOS 精讲

![为什么需要 RTOS：超级循环 vs 平行世界](/anim/why-rtos.svg)

![任务创建与栈初始化](/anim/task-create-stack.svg)

![上下文切换：PendSV 偷梁换柱](/anim/context-switch.svg)

![就绪链表插入：O(1) 调度](/anim/list-insert.svg)

![队列传送：生产到消费](/anim/queue-passing.svg)

![信号量与互斥锁](/anim/semaphore-mutex.svg)

![优先级反转与继承](/anim/priority-inversion.svg)

![任务通知：轻量信号量](/anim/task-notification.svg)

![事件组等待](/anim/event-group-wait.svg)

![软件定时器服务](/anim/software-timer-service.svg)

![heap_4 内存合并](/anim/heap4-coalesce.svg)

## ESP32-S3 + ESP-IDF

![上电三棒接力：ROM → bootloader → app](/anim/esp32-boot-relay.svg)

![IRAM 纪律：Cache 一关，Flash 里就没有代码了](/anim/iram-discipline.svg)

![GPIO 引脚矩阵路由](/anim/gpio-matrix-routing.svg)

![IDF UART 驱动事件](/anim/idf-uart-events.svg)

![LEDC 定时器与通道](/anim/ledc-timer-channel.svg)

![TCP 握手：报文在路上](/anim/tcp-handshake.svg)

## GD32 双系对照

![GD32 RCU 时钟树：与 STM32 逐字段对照](/anim/gd32-rcu-clock.svg)

## 动画规范

动画都是"裸 SVG"：不带脚本、颜色写成属性，构建期由 `AnimFigure` 包装内联进页面，跟随站点深浅主题换色。动效与版式规范见仓库内 `.trellis/spec/docs-site/animation.md`，批量自查跑 `npm run anim:lint`。

想批量核版式（出界/压字），用仓库内 `scripts/anim-audit.html`（用法见动画规范 §7）。

> AI生成