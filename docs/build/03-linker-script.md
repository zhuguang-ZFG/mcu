---
title: B3 链接脚本：固件的建筑图纸
status: building
difficulty: 3
minutes: 40
---

# B3 链接脚本：内存布局的逐行讲解

> 🎯 芯片上电后只认死理：0x08000000 读栈顶、0x08000004 读入口。谁保证你的向量表恰好躺在 0x08000000？不是运气，是链接脚本——固件世界的建筑图纸。

## 本章精髓

1. MEMORY 声明"有几块地"：FLASH 从哪起多大、RAM 从哪起多大——错一个数，链接出来的固件就是"盖在别人家的房子"。
2. SECTIONS 规定"谁住哪间"：.isr_vector 必须第一间；.data 身在 RAM 但行李存 Flash（`>RAM AT> FLASH`）。
3. 符号即界碑：`_sidata/_sdata/_edata/_sbss/_ebss/_estack` 是图纸留给启动代码的门牌号——启动文件和链接脚本是一套榫卯。

## 学习目标

- 逐行讲清 `code/stm32/00-blink/stm32f407xx.ld` 每个语句的作用。
- 能改出变体：把某个数组指定到自定义段 `.ccmram`（F407 的 64KB CCM 内存）。
- 会用 `KEEP()`、`.`（位置计数器）、`ALIGN()` 三个高频语法。

## 先修

- [B2 ELF](02-elf.md)（节/VMA/LMA 概念）、[C1](../c/01-memory-model.md)。

## 先跑起来（10 分钟 quick win）

打开 `code/stm32/00-blink/stm32f407xx.ld` 对照本章；构建后看 `build/blink.map` 里 `.isr_vector` 的地址——0x08000000，图纸生效了。

## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| MEMORY 地块 | F407 的 Flash/RAM/CCM 三块地；ORIGIN+LENGTH 的含义 | 配置 |
| 向量表落位 | 为什么 .isr_vector 必须第一 + KEEP 防 gc-sections 误删 | 配置 |
| .data 的双地址 | `>RAM AT> FLASH` 逐词讲；LOADADDR 怎么变 _sidata | 配置 |
| 符号界碑 | 启动文件回读：五个符号如何驱动 .data 搬运/.bss 清零 | 代码分析 |
| 自定义段实战 | `__attribute__((section(".ccmram")))` + 图纸加房间 | 代码分析 |
| 栈堆预算 | _Min_Stack_Size 检查段的意义：链接期就拦下爆栈 | 配置 |

## 记忆锚点

::: tip 一句话记住
**MEMORY 圈地、SECTIONS 分房、符号留门牌；向量表住头排，.data 人在 RAM 粮存 Flash。**
:::

## 实物实验

- 把 `stm32f407xx.ld` 里 RAM LENGTH 故意改小一半，加一个大数组触发链接报错——体验"图纸在链接期就拦住你"的安全感，然后改回来。

## 常见坑

- **gc-sections 把向量表优化没了**：没人引用就回收——所以必须 `KEEP(*(.isr_vector))`。
- **改 ORIGIN 不改烧录地址**：图纸说 0x08004000，OpenOCD 还烧 0x08000000，芯片照旧从老地方启动。
- **AT> 忘写**：.data 的 LMA 变成 RAM，启动拷贝读到的全是空——初值丢失的隐蔽 bug。
- **CCM 当普通 RAM 用**：DMA 访问不到 CCM，把 DMA 缓冲放那里 = 传输无声失败（S8 联动）。

## 你做到了

- 链接脚本从天书变成可以逐行批改的图纸；
- 能给自己的变量"分房间"，并看懂 map 里的落位结果。

<div class="achievement">
✅ 下一站：<a href="04-startup.html">B4 启动过程</a>——图纸交给施工队：上电到 main 的每一条指令。
</div>
