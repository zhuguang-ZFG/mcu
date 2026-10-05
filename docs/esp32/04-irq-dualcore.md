---
title: P4 中断与双核：IRAM 纪律与核间分工
---

# P4 中断与双核：Cache 关了，你的 ISR 还能跑吗

> 🎯 ESP32 最著名的事故现场：代码在 Flash 里，系统在写 Flash（NVS/OTA 常干）——Cache 一关，取指无门，中断来了直接崩。所以有了铁律：**ISR 和它的全部调用链，必须住进 IRAM**。

## 本章精髓

1. IRAM_ATTR 是生存问题不是性能问题：Cache 关闭窗口内，只有 IRAM/ROM 里的代码可取指——ISR 本体、它调用的函数、用到的 rodata 全要排查（`esp_intr_alloc` 的 ESP_INTR_FLAG_IRAM 标志强制约束）。
2. 中断分配器是"总机"：S3 有 99 个中断源，经中断矩阵分配到两个核的 32 级中断——`esp_intr_alloc` 把外设源、优先级、所属核绑在一起。
3. 双核 SMP 的共享规矩：FreeRTOS 在 S3 上是 SMP 单实例（任务可跑任意核，也可 `xTaskCreatePinnedToCore` 钉核）——核间共享数据用自旋锁/portMUX，**中断与任务、核与核之间 volatile 完全不够**（回 [C3](../c/03-volatile.md) 的边界清单）。

## 学习目标

- 解释 Cache 关闭的三类场景（Flash 写/部分电源操作），并给出 ISR 存活清单。
- 用 `esp_intr_alloc` 手动注册一个 GPIO 中断，区分 IRAM/非 IRAM 两种路径的行为差异。
- 完成一次核间通信：核 0 任务 → 队列 → 核 1 任务，并用钉核 API 验证任务落点。

## 先修

- [P1 启动](01-arch-boot.md)（IRAM/Cache）、[F2 切换](../rtos/freertos/02-context-switch.md)、[S4 NVIC](../stm32/04-nvic-exti.md)（对照）。

## 先跑起来（10 分钟 quick win）

hello 工程里打印 `xPortGetCoreID()`：app_main 默认在核 0；再 `xTaskCreatePinnedToCore(..., 1)` 建任务到核 1——双核第一次"显形"。

## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| 中断矩阵 | 源→核→级的分配链路；esp_intr_alloc 参数全解 | 配置 |
| IRAM 铁律 | Cache 关闭场景清单；IRAM_ATTR/DRAM_ATTR 的正确用法 | 代码分析 |
| 中断到任务 | FromISR+通知/队列在双核下的路径 | 代码分析 |
| 钉核与负载 | PRO/APP 两核的默认分工；Wi-Fi 任务在哪个核 | 配置 |
| 核间互斥 | portMUX_TYPE 自旋锁；与关中断的差异 | 库解析 |
| 对照 STM32 | 单核 NVIC vs 双核中断矩阵的世界观差 | 配置 |

## 记忆锚点

::: tip 一句话记住
**ISR 全家住 IRAM，数据陪住进 DRAM；中断经总机分配到核，核间共享靠自旋锁——volatile 只防编译器，防不住另一个核。**
:::

## 实物实验

- 故意把 ISR 放 Flash（不加 IRAM_ATTR），触发一次 NVS 写+中断并发，复现 Guru Meditation 崩溃——再改回 IRAM 对比，事故教学一气呵成（日志存档）。

## 常见坑

- **ISR 里 printf**：printf 走 UART 驱动，链路长且可能碰 Flash——ISR 用 ESP_DRAM_LOG 或环形缓冲后移。
- **IRAM 里放 rodata 忘 DRAM_ATTR**：字符串字面量默认在 Flash——`printf` 格式串也会取指失败。
- **核间计数用普通 int**：两个核并发 RMW，丢更新是必然——自旋锁或原子内建（C3/C7 复训）。
- **以为钉核是优化**：乱钉核破坏 SMP 负载均衡——先让调度器自由调度，有依据再钉。

## 你做到了

- 双核中断世界观成型：矩阵、IRAM、自旋锁三件套；
- ESP 平台最经典的崩溃案例你亲手复现并修复。

<div class="achievement">
✅ 下一站：<a href="05-uart-driver.html">P5 UART 驱动解析</a>——driver/uart.c 逐行：一个成熟驱动的完整范式。
</div>
