---
title: 对比 0 同概念双实现对照
---

# 对比 0：FreeRTOS × RT-Thread 同一张解剖台

> 🎯 学完两套内核再看对方，处处是"熟悉的陌生人"：同一个问题，两副答案。这张大对照表把 F/R 两篇的全部机制压到一页——复习时按表索骥，迁移时按行翻译。

## 总览对照

| 维度 | FreeRTOS (V11.x) | RT-Thread (5.x) |
|---|---|---|
| 定位 | 极致精简内核 | 内核+组件+生态 |
| 任务对象 | tskTCB | rt_thread（继承 rt_object） |
| 优先级方向 | 数值大=高 | 数值小=高（0 最高） |
| 优先级数 | configMAX_PRIORITIES（常 32） | 32/256（二级位图） |
| 选优算法 | 单级位图+CLZ | 二级位图+查表 |
| 上下文切换 | PendSV（xPortPendSVHandler） | PendSV（rt_hw_context_switch*） |
| tick | xTaskIncrementTick | rt_tick_increase |
| 延时对象 | 延时列表 | 线程内嵌 rt_timer |
| 队列 | Queue（环形+双阻塞表） | 消息队列（变长环形） |
| 信号量/互斥 | 基于队列实现；互斥带继承 | 独立 IPC 对象；互斥带继承 |
| 轻量同步 | 任务通知（TCB 内 32 位） | 无直接等价（用信号量/事件） |
| 事件 | 事件组（24 位） | 事件集（32 位） |
| 软件定时器 | 守护任务执行 | 定时器线程（可系统/用户） |
| 堆管理 | heap_1~heap_5 选一 | memheap/slab/TLSF+内存池 |
| 静态创建 | xTaskCreateStatic 家族 | rt_thread_init 家族 |
| 驱动模型 | 无（裸 API） | rt_device 设备框架（ops 表） |
| 控制台 | 无内置 | finsh/msh |
| 构建/配置 | FreeRTOSConfig.h 手改 | Kconfig+menuconfig+scons |
| 软件生态 | 靠移植/第三方 | 软件包中心（数百个） |
| 可观测 | RunTimeStats/Trace | list_* 命令开箱即用 |

## 机制深对照（三例）

1. **通知 vs 无**：FreeRTOS 任务通知把"一对一同步"做到极致（写 TCB）；RT-Thread 没有等价物，用二值信号量——思想差异：一个抠性能到极致，一个求模型统一。
2. **设备框架**：FreeRTOS 的世界里"驱动"是应用自己的事；RT-Thread 用 ops 表把驱动变成"可插拔商品"——软件包生态的地基。
3. **配置哲学**：FreeRTOSConfig.h 是"C 头文件派"（简单直接，无工具依赖）；Kconfig 是"菜单派"（依赖自动检查，生态可扩展）——小项目爱前者，大系统要后者。

## 记忆锚点

::: tip 一句话记住
**FreeRTOS 把内核做到没有一两赘肉，RT-Thread 把生态做到开箱即用；前者读懂只要一周，后者用全只要一天。**
:::

## 常见坑

- **迁移时数值方向忘换**：FreeRTOS 优先级 5 → RT-Thread 应是"某个更小的数"——方向反，调度行为全反。
- **带 FreeRTOS 习惯找通知**：RT-Thread 没有就用二值信号量替代，别硬造轮子。
- **带 RT-Thread 习惯找设备框架**：FreeRTOS 里 uart 收发要自己写/找驱动库——F4 队列范式就是你的框架。

## 你做到了

- 一页纸看穿两个 OS；
- 拿到任何第三个 RTOS（Zephyr/ThreadX）都能按这张表快速建档。

<div class="achievement">
✅ 下一站：<a href="01-choose.html">对比 1 选型决策树</a>——你的下一个项目，该牵谁的手。
</div>
