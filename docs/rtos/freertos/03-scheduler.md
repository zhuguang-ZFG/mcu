---
title: F3 调度器：一条 CLZ 选出下一个任务
---

# F3 调度器：位图、tick 与阻塞延时

> 🎯 32 个优先级里挑"最高的非空链表"，要遍历几遍？FreeRTOS 的答案：一条 `CLZ`（数前导零）指令，硬件级 O(1)。调度器的聪明，全在这种"把活推给硬件"的设计里。

## 本章精髓

1. 位图就绪表：`uxTopReadyPriority` 是一个 32 位变量，第 N 位=1 表示优先级 N 有就绪任务——`31 - CLZ(位图)` 直接得到最高优先级；链表数组（F1 的货架）负责同优先级轮转。
2. tick 中断干三件事：系统节拍++、检查延时列表里谁该醒了（搬到就绪表）、（同优先级时）请求一次切换——`xTaskIncrementTick` 源码就读这三段。
3. 阻塞延时的真相：`vTaskDelay` 不是"等"，是把任务挂进**延时列表**按唤醒时间排序，然后让出 CPU——任务真的"不在"了，这就是 RTOS 延时 vs 裸机死等的本质区别。

## 学习目标

- 画出"延时列表/就绪列表/阻塞列表"三表的迁移图（任务状态机）。
- 逐行讲 `xTaskIncrementTick`：醒人、换片、同优先级轮转（configUSE_TIME_SLICING）。
- 用 vTaskGetRunTimeStats 实测各任务 CPU 占比，验证调度行为。

## 先修

- [F1](01-task-tcb.md)、[F2 切换](02-context-switch.md)、[S5 SysTick](../../stm32/05-systick.md)。

## 先跑起来（10 分钟 quick win）

两任务同优先级各 vTaskDelay(1)：逻辑分析仪测两个 LED 翻转时刻——1ms 交替出现，时间片轮转眼见为实。

## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| 位图选优 | CLZ 原理与汇编；configMAX_PRIORITIES 的取舍 | 库解析 |
| 三表迁移 | 任务状态机全图（Ready/Blocked/Suspended/Running） | 配置 |
| tick 三段 | xTaskIncrementTick 源码走查 | 库解析 |
| vTaskDelay | 挂入延时列表逐行；vTaskDelayUntil 的周期任务价值 | 代码分析 |
| 抢占点全集 | tick/API 调用/中断退出三处何时切换 | 代码分析 |
| CPU 统计 | RunTimeStats 配置与解读 | 配置 |

## 记忆锚点

::: tip 一句话记住
**位图置位 CLZ 秒选，tick 三事：醒人、轮转、换片场；vTaskDelay 是"挂起等叫"，不是原地死等。**
:::

## 实物实验

- quick win 的轮转证据 + RunTimeStats 打印两任务占比≈50/50；把其中一个优先级+1，占比瞬间 100/0——抢占式调度的铁证。

## 常见坑

- **高优先级任务不延时**：它永不放弃 CPU，低优先级全体饿死——合作式让出（taskYIELD）或延时是基本教养。
- **vTaskDelay(1) 想要精确 1ms**：实际延时 0~1 个 tick 区间（进入时机决定）——要周期精确用 vTaskDelayUntil。
- **configTICK_RATE_HZ 盲目拉 10k**：tick 中断开销按频率线性涨——1kHz 是通用甜点。
- **优先级数量开太多**：每个优先级一条链表，RAM 按条数收租。

## 你做到了

- 调度器从"魔法"变成"位图+链表+三条路径"；
- 能用统计工具证明调度行为，而不是猜。

<div class="achievement">
✅ 下一站：<a href="04-queue.html">F4 队列</a>——任务间的"传送带"：环形存储+两个阻塞列表的源码级解剖。
</div>
