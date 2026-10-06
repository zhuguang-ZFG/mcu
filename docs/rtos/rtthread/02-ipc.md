---
title: R2 IPC 全家桶：一套范式五种武器
status: building
difficulty: 2
minutes: 35
---

# R2 IPC：对象容器 + 挂起列表的统一范式

> 🎯 信号量、互斥量、事件集、邮箱、消息队列——RT-Thread 的 IPC 看起来像五件武器，拆开全是同一副骨架：**一个对象头 + 一个资源计数/存储区 + 一条按优先级排队的挂起列表**。学会一副骨架，五种武器全会。

## 本章精髓

1. 挂起列表（suspend list）是灵魂：`rt_ipc_list_suspend/resume` 统一处理"排队等号"——FIFO 或按优先级（PRIO）两种秩序，创建时一个标志位决定。
2. 五种 IPC 的分工一句话：信号量=计数令牌、互斥量=带持有者与继承的令牌、事件集=32 位旗语、邮箱=定长消息（4 字节）池、消息队列=变长消息环形队——选型按"同步还是传信、消息多大"。
3. 互斥量的继承与 FreeRTOS 同构：`rt_mutex` 记录 owner 与 original priority——同样是火星 bug 的解法，读 `rt_ipc.c` 对照 [F5](../freertos/05-sem-mutex.md) 最有味道。

## 学习目标

- 画出"通用 IPC 骨架图"并把五种 IPC 的特殊字段标注上去。
- 用信号量+邮箱完成中断→线程、线程→线程双通信实战（finsh 观测）。
- 复现优先级反转的 RT-Thread 版本并与 FreeRTOS 版行为对比（[E04](../../lab/e04-priority-inversion.md) 双跑）。

## 先修

- [R1](01-thread-sched.md)、[F4](../freertos/04-queue.md)~[F5](../freertos/05-sem-mutex.md)。

## 先跑起来（10 分钟 quick win）

finsh 一把梭：`list_sem`、`list_mutex`、`list_msgqueue`——刚创建的 IPC 对象全部在册，对象模型（R0）的可观测性再次立功。

## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| 通用骨架 | rt_ipc_object 与挂起列表；FIFO/PRIO 两秩序 | 库解析 |
| 信号量/互斥量 | take/release 源码路径；继承发生点对照 F5 | 库解析 |
| 事件集 | AND/OR 等待与清零语义；与 FreeRTOS 事件组对表 | 配置 |
| 邮箱 vs 消息队列 | 定长池 vs 变长队；内存来源与拷贝成本 | 代码分析 |
| 反转复现 RTT 版 | E04 双跑：两 OS 继承行为实测对比 | 代码分析 |
| finsh 观测 | list_* 系列命令的对象模型原理 | 库解析 |

## 记忆锚点

::: tip 一句话记住
**一副骨架五张皮：令牌、带主令牌、旗语、定长池、变长队；排队要么 FIFO 要么 PRIO，创建时一锤定音。**
:::

## 实物实验

- E04 RT-Thread 版：与 FreeRTOS 版同剧本，两组日志并排贴——继承机制的行为一致性/差异亲眼核对。

## 常见坑

- **事件集 flag 混用接收选项**：RT_EVENT_FLAG_AND/OR + CLEAR 组合语义，与 FreeRTOS 事件组几乎一致但 API 名不同——迁移时逐参数对照。
- **邮箱当消息队列用**：邮箱固定 4 字节（指针/句柄专用）——塞结构体请用消息队列。
- **IPC 对象在中断里的权限**：ISR 只能 send/release，不能 take（同 FreeRTOS 纪律）。
- **delete 时还有线程挂着**：删除前确保无人等待，否则唤醒路径指向已释放内存（RT-Thread 会报警告/断言，别忽略）。

## 你做到了

- IPC 从"五个 API 要背"变成"一副骨架推演"；
- 双 OS 反转实验双跑——你的证据链比教科书还硬。

<div class="achievement">
✅ 下一站：<a href="03-mem.html">R3 内存管理</a>——memheap/slab/TLSF 三选与内存池的确定性之美。
</div>
