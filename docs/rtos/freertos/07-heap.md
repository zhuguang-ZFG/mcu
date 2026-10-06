---
title: F7 内存管理：heap_1 到 heap_5 的人生选择
---

# F7 内存管理：heap_1 到 heap_5 的人生选择

> 🎯 FreeRTOS 给了你五份"内存管理员"简历：从"只进不出的守财奴"（heap_1）到"会拼碎片的清洁工"（heap_4）再到"跨区调度的大管家"（heap_5）。选谁，取决于你的产品敢不敢承受"分配失败"与"碎片"这两件事。

## 本章精髓

1. **heap_1→heap_5 的能力阶梯**：只分配不释放（确定性无敌）→ 可释放不合并（碎片制造机）→ 包 libc 的 malloc（线程安全包装）→ 释放+相邻合并（碎片可控，嵌入式默认答案）→ 多区域堆（SRAM+CCM 分而治之）。
2. **碎片是时间的敌人**：长期运行产品里，"现在够用"不等于"一年后还够"。监控有两个指标要分清：**剩余总量**（`xPortGetFreeHeapSize`）和**历史最小剩余**（`xPortGetMinimumEverFreeHeapSize`）——后者只在 heap_4/heap_5 上有，而且它是"水位最低点"，不是"碎片率"。
3. **动态任务的栈就是从堆里来的**：`xTaskCreate` 内部 `pvPortMalloc` 栈和 TCB（[F1](01-task-tcb.md) 创建六步的第 1、2 步）。"栈不在堆里"的说法只适用于**静态分配**的任务栈和 MSP 主栈——别把两种栈混为一谈。

## 怎么读这一章

- **能记住**：口诀"heap_1 只进不出，heap_4 会合并，heap_5 跨区管；碎片看曲线，爆栈靠哨兵，剩多少问 FreeHeapSize。"
- **能理解**：为什么"总空闲够"不等于"能分出大块"；为什么历史最小剩余量不是碎片率；为什么 heap_2 没有那个指标 API。
- **能用**：给"参数表/任务创建/图形缓冲"三个场景各选一版 heap；用场景 5 亲手看到碎片与合并。

## 学习目标

- 背出 heap_1/2/4/5 的能力差异表，并为三个典型场景各选一版。
- 实测：heap_4 下分配三块、释放中间那块、再要一大块——亲眼看到"总空闲够但最大连续块不够"。
- 说出每个 heap 变体有哪些指标 API 可用（不是每个都有）。

## 先修

- [F1 任务栈](01-task-tcb.md)、[C1 内存模型](../../c/01-memory-model.md)、[B3 链接脚本](../../build/03-linker-script.md)。

## 先跑起来（10 分钟 quick win）

`code/rtos/01-freertos-lab` 场景 5：

```bash
make DEMO_SCENE=5 flash
```

串口日志就是证据链：`boot free` → `after ABC` → `after free B`（总空闲涨了，但 `big ok?=0`——最大连续块不够）→ `after free A`（A 与 B 相邻，heap_4 合并）→ `big ok?2=1`。

## 动画：相邻块合并，不相邻块留洞

heap_4 的空闲链表**按地址排序**，释放时插回去：前后相邻就合并成一块，不相邻就留洞。盯住"总空闲"和"最大连续块"两个数字——它们经常不一样大。

![heap_4 合并动画](/anim/heap4-coalesce.svg)

## 版本与配置前提

- 内核：上游 **FreeRTOS-Kernel V11.1.0**，内存分配 `portable/MemMang/heap_4.c`。
- 本工程 `configTOTAL_HEAP_SIZE = 16KB`，`configSUPPORT_DYNAMIC_ALLOCATION=1`。
- 指标 API 按实际文件核对（见对照表），不凭印象书写。

## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| 一、五版简历 | 能力/确定性/碎片三轴对照表 | 配置 |
| 二、heap_4 合并算法 | 空闲链表按地址排序 + 相邻合并源码逻辑 | 库解析 |
| 三、碎片实验 | 场景 5 的分配/释放/合并证据链 | 代码分析 |
| 四、栈溢出检测 | canary 原理；hook 函数与 S16 联动取证 | 代码分析 |
| 五、heap_5 多区 | SRAM+CCM 双区配置；哪类数据放哪区 | 配置 |
| 六、监控与兜底 | 两个指标的区别；分配失败时的产品级处理 | 代码分析 |

## 一、五版简历：能力阶梯

| 版本 | 分配 | 释放 | 合并 | 确定性 | 碎片 | 适合 |
|---|---|---|---|---|---|---|
| heap_1 | ✅ | ❌ | — | 无敌 | 不产生（也没法用） | 一次性分配的初始化 |
| heap_2 | ✅ | ✅ | ❌ | 好 | 制造机 | 短期演示，别上长期产品 |
| heap_3 | 包 libc malloc | ✅ | 看 libc | 看 libc | 看 libc | 快速原型 |
| heap_4 | ✅ | ✅ | ✅ 相邻合并 | 好 | 可控 | **嵌入式默认答案** |
| heap_5 | ✅ | ✅ | ✅ | 好 | 可控 | 多区域（SRAM+CCM） |

## 二、heap_4 合并算法：按地址排序 + 相邻就拼

heap_4 的空闲链表**按地址从小到大排序**（不是按大小）。释放时 `prvInsertBlockIntoFreeList`（V11.1.0 `heap_4.c:492`）做三件事：

1. 找到插入位置（按地址）；
2. **前邻块**的尾地址若正好接上我，就并进前邻块；
3. **后邻块**的首地址若正好接上我，就把它也并进来。

推论：**只有相邻的空闲块才会合并**。交替分配释放留下的"洞"，永远不会自动拼成大块——这就是碎片的物理来源。

## 三、碎片实验：总空闲 ≠ 最大连续块

场景 5 的完整证据链（串口日志）：

| 步骤 | 操作 | 观察 |
|---|---|---|
| 1 | 启动 | `boot free` ≈ 16KB（减去 TCB/栈等内核开销） |
| 2 | 连续分配 A/B/C 各 1KB | `after ABC` 掉了 ~3KB |
| 3 | 释放 B（中间那块） | `after free B` 涨了 ~1KB，但**总空闲够 2KB，最大连续块不够** |
| 4 | 要一块 2KB | `big ok?=0` —— 失败 |
| 5 | 释放 A（与 B 相邻） | heap_4 合并 A+B |
| 6 | 再要 2KB | `big ok?2=1` —— 合并后成了 |

**这就是"总空闲 ≠ 最大可分配块"的实验证据**。原文档里"动态任务栈来自堆"与"不在堆里"自相矛盾的表述，根子也在这里：动态任务的栈确实从 heap_4 的池子里 `pvPortMalloc` 出来（[F1](01-task-tcb.md)），碎片化直接影响你能不能建新任务。

## 四、栈溢出检测：canary 是更早的哨兵

`configCHECK_FOR_STACK_OVERFLOW=2` 开满后，每次上下文切换时内核检查栈底附近的 0xA5 水位线是否被踩。踩了就调 `vApplicationStackOverflowHook(任务句柄, 任务名)`——本工程打印任务名后停住。

为什么需要它：**爆栈的第一现场往往不是 HardFault，而是"悄悄踩了邻居的数据"**——任务函数读到一个莫名其妙的值、通信偶尔丢包、日志里出现乱码。等 HardFault 再查，现场已经被踩得面目全非。canary 在踩的那一瞬间就抓人。

## 五、heap_5 多区：SRAM 和 CCM 分而治之

heap_5 允许把堆拆成多个区域（HeapRegion 表）：比如 SRAM 放常规分配，CCM（0x10000000 的 64KB，CPU 直连）放实时性敏感的数据。前提是**这些区域 DMA 够不着**（回 [S8](../../stm32/08-dma.md) 的 CCM 禁区）——所以 CCM 里绝对不能放 DMA 缓冲区。

## 六、监控与兜底：指标 API 不是每个版本都有

逐文件核对后的可用性（V11.1.0）：

| 指标 | heap_1 | heap_2 | heap_4 | heap_5 |
|---|---|---|---|---|
| `xPortGetFreeHeapSize` | ✅ | ✅ `:334` | ✅ | ✅ `:435` |
| `xPortGetMinimumEverFreeHeapSize` | ❌ | ❌ | ✅ `:413` | ✅ `:441` |

两个指标的区别：

- **FreeHeapSize**：现在还剩多少（瞬时值）；
- **MinimumEverFreeHeapSize**：历史最低水位（峰值压力）——它回答的是"最坏的时候有多紧张"，**不是碎片率**。碎片率要自己用"最大连续块/总空闲"估。

产品级兜底：分配失败不许静默——要么进安全态，要么记日志告警，要么重启看门狗。静默往下跑，后面全是玄学。

## 记忆锚点

::: tip 一句话记住
**heap_1 只进不出，heap_4 会合并，heap_5 跨区管；碎片看曲线，爆栈靠哨兵，剩多少问 FreeHeapSize，最坏多紧张问 MinimumEver。**
:::

## 实物实验

- 场景 5 完整跑一遍，把日志抄进实验记录；
- 对比实验：把 Makefile 里 `heap_4.c` 换成 `heap_2.c` 再跑——`xPortGetMinimumEverFreeHeapSize` 直接编译不过（heap_2 没有这个 API），这就是"指标 API 要逐文件核对"的现场教学；
- 爆栈捕获：把某任务的栈深从 256 改到 64，看 OverflowHook 抓到谁。

## 常见坑

- **heap_2 用于长期运行产品**：碎片无解，跑着跑着分配失败——长期产品直接 heap_4；
- **configTOTAL_HEAP_SIZE 拍脑袋**：按"任务栈总和 + 队列 + 余量 30%"算，不是越大越好（挤占 .bss）；
- **把历史最小剩余当碎片率**：它是"最坏水位"，不是"碎片程度"——两者都要看；
- **栈溢出只信 HardFault**：很多时候爆栈先踩邻居数据，静默错乱——canary 是更早的哨兵；
- **中断里 pvPortMalloc**：堆分配非原子且可能耗时——ISR 禁地，预先静态分配；
- **CCM 里放 DMA 缓冲区**：DMA 够不着 CCM，数据静悄悄丢失。

## 短自测

1. heap_4 释放一块内存时，什么情况下会合并？
<details><summary>参考答案</summary>只有当被释放的块与空闲链表中的块**地址相邻**时才合并（前邻接尾或后邻接头）。不相邻就留洞——这就是碎片的物理来源。落点：heap_4.c 的 prvInsertBlockIntoFreeList。</details>

2. "总空闲还有 4KB"为什么不能保证能分出 2KB？
<details><summary>参考答案</summary>空闲可能碎成多块不连续的小块。分配器要的是**最大连续块**，不是总空闲。场景 5 的第 3、4 步就是证据。</details>

3. `xPortGetMinimumEverFreeHeapSize` 在哪些 heap 版本上有？它回答的是什么问题？
<details><summary>参考答案</summary>只有 heap_4 和 heap_5 有（V11.1.0 逐文件核对）。它回答"历史最低水位是多少"——峰值压力有多大，不是碎片率。</details>

4. 动态创建的任务，它的栈存在哪里？静态创建的呢？
<details><summary>参考答案</summary>动态创建（xTaskCreate）的栈由内核 pvPortMalloc 从 heap_4 的池子里分；静态创建（xTaskCreateStatic）的栈由调用方提供的静态数组给。MSP 主栈（中断用）在链接脚本里，与堆无关。"栈不在堆里"只对后两种成立。</details>

## 对照表：本章概念 → 仓库与上游落点

| 概念 | 落点 |
|---|---|
| heap_4 相邻合并 | 上游 V11.1.0 `portable/MemMang/heap_4.c:492`（prvInsertBlockIntoFreeList） |
| 指标 API 可用性 | 同上逐文件核对：heap_1:149、heap_2:334、heap_4:413、heap_5:435/441 |
| 动态任务栈来自堆 | 上游 V11.1.0 `tasks.c:1718`（xTaskCreate → pvPortMalloc） |
| 碎片实验 | [code/rtos/01-freertos-lab](https://github.com/zhuguang-ZFG/mcu/tree/main/code/rtos/01-freertos-lab) 场景 5 |
| 动画 | [heap4-coalesce.svg](/anim/heap4-coalesce.svg) |

## 你做到了

- 内存从"够不够"的焦虑变成"可测可控"的工程；
- "总空闲 ≠ 最大连续块"亲手见过一次；
- FreeRTOS 内核篇收官——你已经读完一个真实 RTOS 的全部核心机制。

<div class="achievement">
✅ 下一站：<a href="08-port-f407.html">F8 移植到霸天虎</a>——把前面所有机制在你的板上拼起来跑。
</div>