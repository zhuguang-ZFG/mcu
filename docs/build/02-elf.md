---
title: B2 ELF 解剖：把固件放上解剖台
---

# B2 ELF 解剖：readelf 与 objdump 实拆固件

> 🎯 `.elf` 文件不是一坨机器码，是一具结构分明的"躯体"：节（section）是它的器官，段（segment）是器官在"手术台"（内存）上的摆放方式。学会解剖，以后看到 hex 都自带 X 光。

## 本章精髓

1. 节 vs 段：节是**链接视角**（.text/.data/.bss 分门别类），段是**加载/运行视角**（若干节合并成一个 PT_LOAD 一次性安排到内存）——同一具身体的两张 CT 片。
2. VMA 与 LMA 双地址：.data 的"运行地址"在 RAM（VMA），"存储地址"在 Flash（LMA）——启动拷贝的依据全写在这对地址里（回 [C1](../c/01-memory-model.md)）。
3. 符号表是固件的花名册：每个函数/变量的名字、地址、归属节——`nm` 按地址排序就是一张内存地图。

## 学习目标

- 用 `readelf -h/-S/-l/-s` 分别读出：入口地址、节表、程序头、符号表。
- 在 objdump 反汇编里找到 Reset_Handler 与 main，并指出它们所在的节。
- 解释 blink.elf 里 .data 节的 VMA≠LMA 现象。

## 先修

- [B1 四步构建](01-four-steps.md)、[C1 内存模型](../c/01-memory-model.md)。

## 先跑起来（10 分钟 quick win）

```bash
arm-none-eabi-readelf -h build/blink.elf    # 入口点 0x0800xxxx（Reset_Handler）
arm-none-eabi-objdump -h build/blink.elf    # 节表：看 .isr_vector 在 0x08000000
arm-none-eabi-nm -n   build/blink.elf       # 符号按地址排：内存地图
```

三行命令，固件的骨架立起来。

## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| ELF 头 | 魔数/架构/入口点；为什么入口是 Reset_Handler | 代码分析 |
| 节表巡礼 | .isr_vector/.text/.rodata/.data/.bss 逐一指认 | 配置 |
| 程序头与双地址 | PT_LOAD 的两个（Flash 一个、RAM 一个）；VMA/LMA 实读 | 配置 |
| 符号表 | nm 输出的三列含义；局部/全局/弱符号（weak 回 C5） | 代码分析 |
| 反汇编对照 | objdump -d 找 main 的 push——C6 的 prologue 现场 | 代码分析 |

## 记忆锚点

::: tip 一句话记住
**节管分类，段管装车；VMA 是住址，LMA 是仓库；nm 按地址一排序，固件变地图。**
:::

## 实物实验

- 在 00-blink 里加一个 `const uint8_t tag[8] = "MCU";`，重新构建后用 objdump -h 找出它落在哪个节、VMA 在 Flash 还是 RAM——验证 [C1](../c/01-memory-model.md) 的 const 经济学。

## 常见坑

- **把文件偏移当内存地址**：ELF 里 offset 与地址是两回事，烧 bin 才谈"第几字节"。
- **objdump 反汇编看成Thumb 乱码**：Cortex-M 只跑 Thumb 态，objdump 自动识别；若见"undefined instruction"，多半是数据区被当代码反汇编。
- **只看 .text 大小估固件**：bin 体积还要算 .rodata/.data 初值——`size` 命令的 dec 才是真话（B5 详算）。

## 你做到了

- readelf/objdump/nm 三件套上手；
- 固件从黑盒变成"有地图的建筑"。

<div class="achievement">
✅ 下一站：<a href="03-linker-script.html">B3 链接脚本</a>——谁规定 .isr_vector 必须在 0x08000000？图纸逐行讲。
</div>
