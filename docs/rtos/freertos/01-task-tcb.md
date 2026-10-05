---
title: F1 任务与 TCB：平行世界的出生证
---

# F1 任务与 TCB：xTaskCreate 逐行走查

> 🎯 创建任务像"克隆一个你"去平行世界：克隆体醒来时要以为自己一直在那儿干活——所以 FreeRTOS 把它的栈**伪装成"刚被中断打断"的样子**。看懂这个伪装，就懂了任务的一半。

## 本章精髓

1. TCB（tskTCB）是任务户口本：栈顶指针 `pxTopOfStack` 永远排第一（上下文切换直接按 TCB 地址取栈）、优先级、状态列表项、任务名——`tasks.c` 里逐字段看得完。
2. 栈初始化是一场"化妆"：`pxPortInitialiseStack`（port.c）按异常帧格式把 xPSR/PC(=任务函数)/LR/参数 r0 摆进新栈——第一次切换时，弹栈弹出来的就是"任务开始跑"。
3. 就绪列表按优先级分数组：`pxReadyTasksLists[prio]` 是链表数组——创建任务=挂进对应优先级的链表尾巴（F3 调度器的货架）。

## 学习目标

- 对照源码讲出 xTaskCreate 的六步：分栈→分 TCB→初始化栈→初始化 TCB→挂就绪表→（必要时）触发调度。
- 用 GDB 查看一个新任务的初始栈内容，指认 xPSR/PC/r0 的位置。
- 估算"N 个任务"的 RAM 账单（TCB+栈）并给出栈大小分配方法。

## 先修

- [F0](00-why-rtos.md)、[C6 栈帧](../../c/06-abi-stack.md)、[B4 启动](../../build/04-startup.md)。

## 先跑起来（10 分钟 quick win）

跑通 F8 移植工程后：创建两个任务各闪一灯，GDB 里 `p pxCurrentTCB` 看户口本，`x/16xw pxCurrentTCB->pxTopOfStack` 看栈——账本与现场同框。

## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| TCB 逐字段 | pxTopOfStack 必须第一的汇编级原因 | 库解析 |
| 栈的化妆术 | pxPortInitialiseStack 逐行；初始 xPSR 为什么是 0x01000000 | 库解析 |
| 创建六步 | xTaskCreate 源码走查 | 库解析 |
| 就绪货架 | 链表数组结构；同级任务的轮转位 | 配置 |
| RAM 账单 | 栈怎么估（调用深度×帧+余量）；uxTaskGetStackHighWaterMark 实测 | 代码分析 |

## 记忆锚点

::: tip 一句话记住
**TCB 是户口本，栈顶指针写第一行；新栈化个"中断妆"，一弹栈任务就出生。**
:::

## 实物实验

- 创建任务时给栈填 0xA5 水位线（FreeRTOS 自动做），运行后调用 `uxTaskGetStackHighWaterMark` 打印——用真实水位把栈预算从玄学变工程。

## 常见坑

- **栈给太小**：不报错，悄悄踩到隔壁任务/堆——症状是"莫名其妙 HardFault"（S16 取证）。
- **任务函数返回**：任务不许 return（返回地址指向死循环断言）——结尾必须 vTaskDelete(NULL)。
- **优先级乱排**：数值越大优先级越高（与中断 NVIC 数值规则相反！）——两套规则混用是经典翻车。
- **创建时传参生命周期**：传局部变量地址，创建者返回后任务读到野指针（C1 存储期复训）。

## 你做到了

- 任务的"出生"在你眼里是透明的六步；
- 栈与 TCB 不再抽象——你会算、会看、会量。

<div class="achievement">
✅ 下一站：<a href="02-context-switch.html">F2 上下文切换</a>——PendSV 逐汇编指令，换魂术全公开（动画）。
</div>
