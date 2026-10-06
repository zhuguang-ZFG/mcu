---
title: F2 上下文切换：PendSV 换魂术
status: done
difficulty: 3
minutes: 45
---

# F2 上下文切换：PendSV 逐汇编指令

> 🎯 两个任务"同时在跑"的幻觉，每毫秒发生一次偷梁换柱：把当前任务的魂（寄存器）抽走封进它的栈，把下一个任务的魂从它的栈里请回来。执刑官是 PendSV——全系统优先级最低的中断。本章把这十来条汇编逐行过堂。

## 本章精髓

1. 为什么是 PendSV 且必须最低：切换要等所有中断服完役才进行，否则 ISR 被"切走一半"就乱套——最低优先级保证 PendSV 永远最后执行。
2. 切换就两个动作：**存**（当前任务的 r4-r11 软件补压 + 栈顶存进 TCB）与**取**（从下个任务 TCB 取栈顶 + r4-r11 弹回）——硬件帧（r0-r3 等）由异常进出自动完成，软件只需管 r4-r11。
3. 选择下一个任务靠 `pxCurrentTCB` 换指针：`vTaskSwitchContext` 只是改了这个全局变量——PendSV 按新值取栈，"换魂"完成。

## 怎么读这一章

- **能记住**：记忆锚点那四句——存谁、取谁、换什么指针。
- **能理解**：为什么硬件管一半、软件管另一半（第二节，AAPCS 的账）。
- **能用**：在 GDB 里给 PendSV 打断点，把动画里的每一帧在真板上找到（第五节）。

## 学习目标

- 逐行讲清 port.c 的 `xPortPendSVHandler`：取栈顶/存 r4-r11/存 TCB/换指针/取新栈/弹回/异常返回。
- 在 GDB 里观察 pxCurrentTCB 指针前后变化与 PSP 切换。
- 解释为什么 PSP 指任务栈、MSP 指内核与中断栈（EXC_RETURN bit2 的作用）。

## 先修

- [F1 任务与 TCB](01-task-tcb.md)、[S4 中断现场](../../stm32/04-nvic-exti.md)、[C6 调用约定](../../c/06-abi-stack.md)。

## 动画：换魂全程

TaskA 的魂（r4-r11）被压进它自己的栈、栈顶藏进 TCB；换指针；TaskB 的魂从它的栈里弹回——注意两个栈此消彼长，CPU 还是那个 CPU。

![上下文切换动画](/anim/context-switch.svg)

## 配套视频

<VideoEmbed type="bilibili" id="BV1Jx411X7NS" title="野火《FreeRTOS 内核实现与应用开发实战指南》配套视频（42 集，从 0 到 1 写内核）" />

## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| 一、PendSV 定位 | 为什么最低优先级；与 SysTick 的配合 | 配置 |
| 二、软硬分工 | 硬件帧 vs r4-r11：AAPCS 的账（回 C6） | 代码分析 |
| 三、汇编逐行 | xPortPendSVHandler 十一条逐条过堂 | 库解析 |
| 四、换指针即换魂 | vTaskSwitchContext 与 TCB 第一成员 | 库解析 |
| 五、GDB 目击 | 断点 + 双任务栈对照实验 | 代码分析 |

## 一、PendSV 定位：执刑官为什么永远最后上场

SysTick 每 1ms 来一次，但它的活只是**报案**：`xTaskIncrementTick()` 发现"有更高优先级任务就绪了"，就写一笔挂起位——

```
ICSR（0xE000ED04）bit28 = PENDSVSET：把 PendSV 异常挂起
```

真正的执法交给 PendSV。为什么绕这一手？因为 SysTick 优先级高，**若在 ISR 堆里直接切换，等于把某个中断服务程序切走一半**——外设寄存器读到一半、标志位清到一半，回来全乱。PendSV 的优先级被设为 **0xFF，全系统最低**：它永远排队到最后，等所有 ISR 收队完毕，才出来执行切换。

> **【注】`configKERNEL_INTERRUPT_PRIORITY` 配错是"偶发灵异 bug"的头号来源**——切换抢在 ISR 前头执行，现场随机崩，一周一次那种。常见坑一节还会点名。

## 二、软硬分工：硬件管一半，软件管另一半

异常入场时，硬件已自动压好 8 个字的**硬件帧**（[S4 动画](../../stm32/04-nvic-exti.md)演示过）：xPSR、PC、LR、R12、R3~R0。这是 AAPCS 的"调用者保存"部分——硬件替你管了。

那 **r4-r11** 呢？AAPCS 说它们是"被调者保存"——函数要用就自己存。硬件不认识这个约定，所以 PendSV 里**软件手工补压 r4-r11**。软硬两半合起来，才是一个任务完整的"魂"。

FPU 再加一层：若任务用过浮点（EXC_RETURN **bit4 = 0** 为证），硬件帧会扩展带上 s0-s15+FPSCR，软件还要加存 **s16-s31**。

> **【注】懒堆叠（lazy stacking）**：M4F 的 FPCCR（LSPEN 默认开）让硬件"先占座、后写真"——入场时先给 FPU 帧**预留空间**，真用到 FPU 才写数，大多数不用浮点的中断省下这笔开销。所以 EXC_RETURN bit4 是"这趟有没有 FPU 行李"的牌子。

## 三、汇编逐行：xPortPendSVHandler 过堂

以下摘自 FreeRTOS-Kernel V11.x 的 `portable/GCC/ARM_CM4F/port.c`（M4F + GCC 移植层原文，注释为本章所加）：

```asm
mrs   r0, psp                ; ① 取出当前任务的栈顶（PSP）
isb
ldr   r3, =pxCurrentTCB      ; ② r3 = &pxCurrentTCB
ldr   r2, [r3]               ;    r2 = 当前任务的 TCB
tst   r14, #0x10             ; ③ 这趟有 FPU 行李吗（EXC_RETURN bit4=0）？
it    eq
vstmdbeq r0!, {s16-s31}      ;    有：先把 FPU 高 16 寄存器压栈
stmdb r0!, {r4-r11, r14}     ; ④ 软件帧：r4-r11 + EXC_RETURN 压进任务栈
str   r0, [r2]               ; ⑤ 新栈顶存进 TCB 第一个成员——封棺！
stmdb sp!, {r0, r3}          ;    （保护现场，进临界区）
mov   r0, #configMAX_SYSCALL_INTERRUPT_PRIORITY
msr   basepri, r0            ; ⑥ 临界区：屏蔽低优先级中断
dsb
isb
bl    vTaskSwitchContext     ; ⑦ 换指针：pxCurrentTCB = 下一个任务
mov   r0, #0
msr   basepri, r0            ;    出临界区
ldmia sp!, {r0, r3}
ldr   r1, [r3]               ; ⑧ r1 = 新 TCB（pxCurrentTCB 已换人）
ldr   r0, [r1]               ;    r0 = 新任务的栈顶
ldmia r0!, {r4-r11, r14}     ; ⑨ 还魂：软件帧从新任务栈弹回
tst   r14, #0x10
it    eq
vldmiaeq r0!, {s16-s31}      ;    FPU 行李也领回
msr   psp, r0                ; ⑩ PSP 指向新任务的栈顶
isb
bx    r14                    ; ⑪ 异常返回：硬件弹出硬件帧，新任务复活
```

| 步骤 | 指令 | 一句话 |
|---|---|---|
| ① | `mrs r0, psp` | 当前任务的栈顶在哪？（线程用的是 PSP，不是 MSP） |
| ② | `ldr r3/ldr r2` | 拿到"当前任务档案"TCB |
| ③ | `tst + it + vstmdb` | 有 FPU 行李就先托运 s16-s31 |
| ④ | `stmdb {r4-r11, r14}` | 软件帧入栈——魂魄抽离 |
| ⑤ | `str r0, [r2]` | **栈顶存进 TCB 第一个成员**——为什么敢写偏移 0？第四节揭晓 |
| ⑥ | `basepri` | 换指针时要安静：临界区 |
| ⑦ | `bl vTaskSwitchContext` | 全剧就这一句：换个全局指针 |
| ⑧⑨ | `ldr/ldmia` | 新 TCB → 新栈顶 → 魂魄归还 |
| ⑪ | `bx r14` | 异常返回，硬件弹硬件帧——**新任务从它上次停下的那条指令接着跑** |

## 四、换指针即换魂

`vTaskSwitchContext`（tasks.c）的核心动作一句话：`pxCurrentTCB = 最高优先级就绪任务的 TCB`（怎么选出最高的？位图 + CLZ 一条指令，[F3 调度器](03-scheduler.md)细讲）。

⑤ 号指令 `str r0, [r2]` 为什么敢往偏移 0 写？因为 FreeRTOS 立下铁律：**TCB 结构体的第一个成员永远是 `pxTopOfStack`**。偏移 0 就是栈顶的家——封棺与起棺都从这进门。

整个切换，C 部分只换了一个指针；真正的体力活全在 PendSV 那十一条汇编里。**换指针是决策，PendSV 是执行**——决策与执行分离，这就是 FreeRTOS 切换设计的全部智慧。

> **【注】切换有多快？** M4 @168MHz 下一次完整切换是**百周期量级**，微秒不到——"RTOS 开销大"的直觉多为谣言，[F7](07-heap.md) 会算这笔账。

## 五、GDB 目击实验

双任务各闪一灯（E 系列实验工程），把动画的每一帧在真板上抓到：

```gdb
b xPortPendSVHandler     # 断在换魂入口
p pxCurrentTCB           # 记下旧任务 TCB 地址
p/x $psp                 # 记下旧 PSP
x/8xw $psp               # 栈顶 8 字：先认硬件帧（回 S4）
finish                   # 跑完整个 handler 再看一次
p pxCurrentTCB           # 已换人！对比两次地址
```

## 记忆锚点

:::: tip 一句话记住
**PendSV 最后上场，r4-r11 手工进栈，栈顶藏进 TCB；换个指针换个魂，异常返回新人生。**
::::

## 实物实验

- 见第五节 GDB 目击清单；装备：霸天虎板 + FreeRTOS 双任务工程 + ST-Link。
- 进阶：在任务里加一行浮点运算，再观察 `tst r14, #0x10` 走 `eq` 分支——亲眼确认 FPU 行李托运。

## 常见坑

- **中断里调 API 忘 FromISR 版**：普通版 API 在 ISR 里可能直接触发切换，现场混乱——ISR 一律 `xQueueSendFromISR` 家族（[F4 队列](04-queue.md)）。
- **PendSV/SysTick 优先级没设最低**：`configKERNEL_INTERRUPT_PRIORITY` 配错，切换抢占 ISR——偶发灵异 bug 的头号来源。
- **栈对齐不是 8 字节**：xPSR 异常入场要求 8 对齐，栈起点错对齐直接 UsageFault（S16 取证）。
- **以为切换很慢**：M4 上一次切换是百周期量级——"RTOS 开销大"的直觉多为谣言。

## 短自测

1. 切换为什么在 PendSV 里做，而不是在 SysTick 中断里直接做？
2. 硬件帧和软件帧各包含哪些寄存器？（FPU 情况各加什么？）
3. `str r0, [r2]` 把栈顶存到了 TCB 的哪里？凭什么敢这么写？
4. `bx r14` 之后硬件做了什么？新任务从哪条指令开始跑？

<details><summary><b>参考答案（先自己想完再展开）</b></summary>

1. SysTick 优先级高，ISR 堆里直接切换会把某个中断服务切走一半；PendSV 优先级最低（0xFF），等所有 ISR 收队才执法。
2. 硬件帧：R0-R3、R12、LR、PC、xPSR（FPU 加 s0-s15+FPSCR）；软件帧：R4-R11 和 EXC_RETURN（FPU 加 s16-s31）。
3. TCB 第一个成员 `pxTopOfStack`——偏移 0 是 FreeRTOS 的铁律。
4. 硬件按 EXC_RETURN 选用 PSP，从任务栈弹出硬件帧；新任务从它上次被切走时的 PC（就在硬件帧里）继续执行。

</details>

## 对照表：本章概念 → 源码落点

| 本章说的 | 源码里哪里 |
|---|---|
| 换魂十一条汇编 | FreeRTOS-Kernel V11.x `portable/GCC/ARM_CM4F/port.c` 的 `xPortPendSVHandler` |
| 换指针 | 同内核 `tasks.c` 的 `vTaskSwitchContext` |
| PendSV 挂起位 | ICSR = 0xE000ED04，bit28（PENDSVSET） |
| 栈帧约定 | [C6 调用约定](../../c/06-abi-stack.md) + [S4 中断动画](../../stm32/04-nvic-exti.md) |
| 启动时 MSP 的的来历 | [B4 启动过程](../../build/04-startup.md) 第一节 |
| 选最高优先级任务 | [F3 调度器](03-scheduler.md)（位图 + CLZ） |

## 你做到了

- "换魂术"全程目击并能逐行讲解；
- 上下文切换从此没有黑盒——这是理解一切 RTOS 行为的总钥匙；
- 再看到 `taskYIELD()` 或 `portYIELD_FROM_ISR`，你知道它们在跟 PendSV 打招呼。

<div class="achievement">
✅ 下一站：<a href="03-scheduler.html">F3 调度器</a>——位图就绪表 32 选 1 只要一条 CLZ，tick 里到底发生了什么。
</div>
