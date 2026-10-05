---
title: F2 上下文切换：PendSV 换魂术
---

# F2 上下文切换：PendSV 逐汇编指令

> 🎯 两个任务"同时在跑"的幻觉，每毫秒发生一次偷梁换柱：把当前任务的魂（寄存器）抽走封进它的栈，把下一个任务的魂从它的栈里请回来。执刑官是 PendSV——全系统优先级最低的中断。

## 本章精髓

1. 为什么是 PendSV 且必须最低：切换要等所有中断服完役才进行，否则 ISR 被"切走一半"就乱套——最低优先级保证 PendSV 永远最后执行。
2. 切换就两个动作：**存**（当前任务的 r4-r11 软件补压+栈顶存进 TCB）与**取**（从下个任务 TCB 取栈顶+r4-r11 弹回）——硬件帧（r0-r3 等）由异常进出自动完成，软件只需管 r4-r11。
3. 选择下一个任务靠 `pxCurrentTCB` 换指针：`vTaskSwitchContext` 只是改了这个全局变量——PendSV 按新值取栈，"换魂"完成。

## 学习目标

- 逐行讲清 port.c 的 `xPortPendSVHandler`：MRS/存 r4-r11/存栈顶/调 vTaskSwitchContext/取栈顶/弹 r4-r11/异常返回。
- 在 GDB 里给 PendSV 打断点，观察 pxCurrentTCB 指针前后变化与 PSP 切换。
- 解释为什么 PSP 指任务栈、MSP 指中断/内核栈（LR=0xFFFFFFFD 的 bit2 作用）。

## 先修

- [F1 任务与 TCB](01-task-tcb.md)、[S4 中断现场](../../stm32/04-nvic-exti.md)、[C6](../../c/06-abi-stack.md)。

## 动画：换魂全程

![上下文切换动画](/anim/context-switch.svg)

## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| PendSV 定位 | 为什么最低优先级；与 SysTick 的配合（tick 里挂起 PendSV） | 配置 |
| 汇编逐行 | xPortPendSVHandler 每条指令的作用（MRS/CPSID/STDB/LDMD 逐个讲） | 库解析 |
| 软硬分工 | 硬件帧 vs r4-r11：为什么 r4-r11 要软件管（AAPCS 回 C6） | 代码分析 |
| 换指针即换魂 | vTaskSwitchContext 与 pxCurrentTCB；FPU 懒堆叠（lazy stacking）一句话 | 库解析 |
| GDB 目击 | 断点+双任务栈对照实验 | 代码分析 |

## 记忆锚点

::: tip 一句话记住
**PendSV 最后上场，r4-r11 手工进栈，栈顶藏进 TCB；换个指针换个魂，异常返回新人生。**
:::

## 实物实验

- 双任务各闪一灯，GDB 在 PendSV 入口/出口各采样一次 PSP 与 pxCurrentTCB——把动画里的每一帧在真板上找到证据。

## 常见坑

- **中断里调 API 忘 FromISR 版**：普通版 API 在 ISR 里可能直接触发切换，现场混乱——ISR 一律 `xQueueSendFromISR` 家族（F4）。
- **PendSV/SysTick 优先级没设最低**：configKERNEL_INTERRUPT_PRIORITY 配错，切换抢占 ISR——偶发灵异 bug 的头号来源。
- **栈对齐不是 8 字节**：xPSR 异常入场要求 8 对齐，栈起点错对齐直接 UsageFault（S16 取证）。
- **以为切换很慢**：M4 上一次切换约几十到一百周期级——"RTOS 开销大"的直觉多为谣言（F7 实测）。

## 你做到了

- "换魂术"全程目击并能逐行讲解；
- 上下文切换从此没有黑盒——这是理解一切 RTOS 行为的总钥匙。

<div class="achievement">
✅ 下一站：<a href="03-scheduler.html">F3 调度器</a>——位图就绪表 32 选 1 只要一条 CLZ，tick 里到底发生了什么。
</div>
