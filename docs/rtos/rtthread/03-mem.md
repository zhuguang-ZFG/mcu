---
title: R3 RT-Thread 内存管理：确定性之美
---

# R3 内存管理：memheap、slab、TLSF 与内存池

> 🎯 FreeRTOS 问你"选 heap 几"，RT-Thread 问得更细：通用堆要确定性（TLSF）还是要简单（memheap）？内核小对象要不要专用快车道（slab）？实时路径上干脆别用堆——用**内存池**（分配时间是常数）。

## 本章精髓

1. 三套堆策略的场景分治：memheap（多地址段拼接，简单够用）、slab（内核对象的小块高速缓存，碎片免疫）、TLSF（Two-Level Segregated Fit，分配/释放都近 O(1)，大内存与实时性的双优生）。
2. 内存池（rt_mp）是实时的答案：固定块大小+空闲链表——分配=摘链表头，O(1) 且无碎片；代价是块大小一刀切（大材小用浪费，小了装不下）。
3. 静态内存潮：RT-Thread 与 FreeRTOS 一样支持"全静态创建"——安全关键场景连堆都可以不要（RT_USING_HEAP 关掉）。

## 学习目标

- 说出 memheap/slab/TLSF 三者的适用内存规模与确定性差异。
- 用 rt_mp_create/rt_mp_alloc 实现固定块池，并测量与 rt_malloc 的分配耗时差。
- 解释 slab 为什么"碎片免疫"（固定格大小 + 页内 bitmap 的直觉版）。

## 先修

- [F7 heap](../freertos/07-heap.md)（对照锚点）、[C1](../../c/01-memory-model.md)。

## 先跑起来（10 分钟 quick win）

同一申请量分别用 `rt_malloc` 与 `rt_mp_alloc` 各跑 1 万次，rt_tick 差打印——内存池的确定性，数字自己会说话。

## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| 三套堆 | memheap/slab/TLSF 场景分治表 | 库解析 |
| TLSF 直觉 | 两级位图怎么做到近 O(1)（与 RTT 调度二级位图同源思想！） | 库解析 |
| 内存池 | 固定块池的结构与 O(1) 证明；块大小设计 | 代码分析 |
| 静态创建 | object init 系列 API；关 HEAP 的固件形态 | 配置 |
| 泄漏与监控 | list_memheap/rt_memory_info；与 F7 监控法对照 | 代码分析 |

## 记忆锚点

::: tip 一句话记住
**通用堆选 TLSF，内核小块走 slab，实时路径上内存池；池子 O(1) 无碎片，就是块大不能挑。**
:::

## 实物实验

- quick win 耗时对比 + 故意把池块用尽看 `rt_mp_alloc` 挂起等待的行为（超时参数）——资源池排队的真实体感。

## 常见坑

- **块大小拍脑袋**：池块按"最大成员+对齐"定，宁大勿小——放不下时 alloc 直接失败。
- **内存池里放变长数据**：变长需求回 TLSF，别硬塞池子。
- **混用 alloc/free 家族**：rt_malloc 与 rt_mp_free 交叉释放=内存灾难——谁家的孩子谁领走。
- **TLSF 当万能药**：小内存（<几 KB）场景它的元数据占比过高——小堆 memheap 更划算。

## 你做到了

- 内存管理的"确定性"维度被量化；
- 两套 OS 的内存哲学在你脑中完成对照。

<div class="achievement">
✅ 下一站：<a href="04-device.html">R4 设备框架</a>——RT-Thread 最灵魂的一章：驱动与应用如何解耦。
</div>
