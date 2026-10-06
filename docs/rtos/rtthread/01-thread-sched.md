---
title: R1 线程与调度：256 级位图的另一种写法
status: building
difficulty: 2
minutes: 35
---

# R1 线程与调度：rt_thread 解剖

> 🎯 FreeRTOS 用 32 位位图管 32 个优先级；RT-Thread 说 32 个不够，上 256 级——位图还是那张位图，只是升级成"二级位图"（32×8）。同样的 CLZ，加一层索引，调度依然是 O(1)。

## 本章精髓

1. `struct rt_thread` 与 TCB 对照：对象头（R0 的继承）+ `sp`（栈顶）+ 优先级 + 状态 + 剩余 tick + 定时器（线程自带 `rt_timer`！）——功能等价物都能找到，结构风格更"面向对象"。
2. 二级位图：`rt_thread_ready_table[32]` 每字节管 8 个优先级，`rt_thread_ready_priority_group` 管哪字节非空——两次 CLZ/查表定位最高优先级（源码 `rt_schedule` + `_get_highest_priority_thread`）。
3. 调度点的同与不同：同样有 tick（`rt_tick_increase`）、有抢占；不同的是 RT-Thread 把"线程延时"挂在**线程自带的定时器**上——定时器子系统是全家共享的基础设施。

## 学习目标

- 逐字段对照 rt_thread 与 tskTCB（画双列对照表）。
- 讲清二级位图选优的过程，并指出与 FreeRTOS 单级位图的取舍（优先级数 vs 查询步数）。
- 用 `rt_thread_create/init` 两种创建方式各建一线程，说出动态/静态创建的差异（堆 vs 自备内存）。

## 先修

- [R0](00-arch.md)、[F1](../freertos/01-task-tcb.md)~[F3](../freertos/03-scheduler.md)。

## 先跑起来（10 分钟 quick win）

finsh 里 `list_thread` 看自家线程表：名称/优先级/状态/栈用量一屏出——RT-Thread 的"可观测性"开箱即用。

## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| rt_thread 解剖 | 字段逐一对照 tskTCB | 库解析 |
| 二级位图 | 256 级选优的两步查表；与 32 级的取舍 | 库解析 |
| 动态 vs 静态 | rt_thread_create vs rt_thread_init 的内存来源 | 配置 |
| tick 与定时器 | rt_tick_increase 与线程内嵌 rt_timer | 库解析 |
| 调度点 | rt_schedule 的进入路径（API/中断退出/tick） | 代码分析 |
| 栈与水位 | list_thread 的栈用量列；与 F 篇水位线对照 | 代码分析 |

## 记忆锚点

::: tip 一句话记住
**对象打头 sp 记账，256 级两查表；动态堆上请，静态自家造；线程肚里还揣着定时器。**
:::

## 实物实验

- 双线程异频闪灯 + `list_thread` 观测栈水位；
- GDB 对照两 OS 的"就绪表"内存布局（同一台板子两份固件）——对照学习的第一个硬证据。

## 常见坑

- **静态线程忘了栈对齐**：自供栈必须 8 字节对齐（RT_ALIGN）——不对齐下场同 F2。
- **删除线程在自身上下文**：自杀用 `rt_thread_delete(rt_thread_self())` 并在调度中清理——理解"死亡也要排队"。
- **优先级习惯沿用 FreeRTOS 数值感**：RT-Thread 数值越小优先级越高（0 最高）——与 NVIC 同向、与 FreeRTOS 反向，三家对照背熟。
- **启动线程忘 rt_thread_startup**：create 只是造好，startup 才挂就绪——少一步永远不动。

## 你做到了

- 第二个内核的线程/调度机制打通；
- "同一问题两种解法"的对照眼练成。

<div class="achievement">
✅ 下一站：<a href="02-ipc.html">R2 IPC 全家桶</a>——信号量/互斥量/事件/邮箱/消息队列：一套范式五种武器。
</div>
