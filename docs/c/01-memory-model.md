---
title: C1 内存模型：一个变量的三段旅程
---

# C1 内存模型：一个全局变量的三段旅程

> 🎯 `int led_count = 5;` 这一行，在你的固件里其实存在了**三份**：源码里的声明、Flash 里的初值 5、RAM 里的那个"活人"。谁把它从 Flash 搬到 RAM 的？答不上来，就还没真正懂全局变量。

## 本章精髓

1. 变量的"存储期"决定它住在哪：.text（代码）、.data（有初值全局）、.bss（无初值全局）、栈（局部）、堆。
2. 上电瞬间 .data 还没在 RAM 里——是 Reset_Handler 搬的家（[B4](../build/04-startup.md) 逐指令演示）。
3. const 在嵌入式里是省钱大招：`const` 数组留 Flash，不花一分 RAM。

## 学习目标

- 给定任意变量声明，能说出它落在哪个段、占 Flash 还是 RAM。
- 能解释 `_sidata/_sdata/_edata/_sbss/_ebss` 五个符号的含义（链接脚本产出）。
- 会用 `nm`/`map` 文件查自己变量的实际地址。

## 先修

- [C0](00-c-in-mcu.md)；[B1 四步构建](../build/01-four-steps.md) 可并行读。

## 先跑起来（10 分钟 quick win）

在 00-blink 的 `main.c` 里加 `volatile int g_flag = 1;`（全局）和 `static uint8_t g_buf[16];`，`make` 后执行 `arm-none-eabi-nm build/blink.elf | sort`——看 g_flag 落在 .data 区（有地址），g_buf 落在 .bss。

## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| 五段论 | .text/.rodata/.data/.bss/栈堆逐段讲解 + F407 地址实拍 | 配置 |
| 三段旅程 | 以 `int x=5` 追踪：源码→ELF 的 .data+LMA→启动拷贝→RAM | 代码分析 |
| const 经济学 | `const uint8_t font[]` 为什么该留 Flash；段归属实验 | 代码分析 |
| nm/map 实操 | 亲手查符号地址；与链接脚本对照 | 代码分析 |

## 记忆锚点

::: tip 一句话记住
**有初值住 .data（Flash 存粮票，RAM 住人），没初值住 .bss（只分房不带行李），const 留 Flash（不动产的忠实租客）。**
:::

## 实物实验

- GDB 里打印 `&g_flag` 和 `_sidata`：验证"人在 RAM、粮票在 Flash"；改 `g_flag=2` 后复位，它又变回 1——因为 Flash 里的粮票没动。

## 常见坑

- **以为 .bss 不占空间**：它不占 Flash 但占 RAM——`uint8_t buf[100*1024];` 直接爆 RAM。
- **大数组初始化器放错地方**：`uint8_t lut[1024] = {...}` 既吃 Flash 又吃 RAM；加 `const` 立省一半。
- **在启动完成前用全局变量**：中断开启太早，.data 还没搬完——读到的全是 0/垃圾。

## 你做到了

- 任何变量都能说出"住哪、谁交房租"；
- nm/map 文件从乱码变成你审计内存的工具。

<div class="achievement">
✅ 下一站：<a href="02-pointer.html">C2 指针</a>——为什么 *(volatile uint32_t *)0x40020014 能点灯。
</div>
