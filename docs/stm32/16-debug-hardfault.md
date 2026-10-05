---
title: S16 HardFault 与排错：崩溃现场的法医技术
---

# S16 HardFault：崩溃现场的法医技术

> 🎯 程序跑着跑着不动了，灯不闪了，printf 沉默了——恭喜你遇到 HardFault。新手靠猜，法医靠证据：故障寄存器里写着"死因"，栈里躺着"案发现场"。

## 本章精髓

1. 故障是"异常升级"：MemManage/BusFault/UsageFault 可单独使能，没使能或处理不当就升级成 HardFault——SCB 的 HFSR 告诉你是不是"升级案"。
2. 三份验尸报告：**CFSR**（可配置故障状态：除零/未对齐/非法指令/访问违例逐位标注）、**BFAR**（总线故障的具体地址）、**MMFAR**（存储管理故障地址）——地址一指，凶手现形。
3. 栈帧即现场：异常进入时硬件压的 8 个字（回 [S4](04-nvic-exti.md) 动画）里有**案发时的 PC**——从栈里挖出 PC，用 addr2line/objdump 反查源码行。

## 学习目标

- 实现一个打印 CFSR/HFSR/BFAR/MMFAR + 栈帧 PC/LR 的 HardFault_Handler。
- 完成"挖 PC 查行号"全流程：栈帧→PC→`arm-none-eabi-addr2line -e blink.elf 0x08xxxxxx`。
- 复现并修复三类常见死因：空指针、未对齐访问、除零。

## 先修

- [S4 中断现场](04-nvic-exti.md)、[C6 栈帧](../c/06-abi-stack.md)、[B2 objdump](../build/02-elf.md)。

## 先跑起来（10 分钟 quick win）

故意写 `*(volatile uint32_t*)0xFFFFFFFF = 0;` 触发 HardFault，用本章 Handler 打印——第一次"按地址抓凶手"。

## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| 故障家族 | HardFault/MemManage/BusFault/UsageFault 关系图 | 配置 |
| 验尸三寄存器 | CFSR 位逐个翻译；BFAR/MMFAR 有效性位 | 配置 |
| 栈帧取证 | MSP/PSP 判定（LR bit2）；8 字里找 PC | 代码分析 |
| Handler 实现 | 汇编取栈指针 + C 打印的最小实现 | 代码分析 |
| addr2line 反查 | PC→源码行号；map 文件交叉验证 | 代码分析 |
| 高频死因 | 空指针/未对齐/除零/栈溢出/中断优先级五大命案 | 库解析 |

## 记忆锚点

::: tip 一句话记住
**先看 CFSR 定罪名，再查 BFAR 指现场，栈里挖 PC 对行号；死因五虎：空针、错位、除零、爆栈、优先级。**
:::

## 实物实验

- 三大命案各复现一次：空指针写、未对齐访问（奇地址强转 uint32_t*）、`x/0`——每次记录 CFSR 值与 PC 行号，贴进实验记录。

## 常见坑

- **Handler 里用 printf 本身再崩**：故障里跑复杂库函数可能二次故障——Handler 保持极简（直接寄存器串口或半主机）。
- **MSP/PSP 拿错**：RTOS 下任务用 PSP，拿 MSP 读栈全是错的（LR bit2 判定，F 篇再练）。
- **没开 -g 编译**：addr2line 查不到行号——调试版本务必 `-g3`。
- **只看 PC 不看 LR**：LR（压栈值）告诉你"从谁调用来"，调用链还原靠它（配合 map 追 caller）。

## 你做到了

- HardFault 从"玄学死机"变成"按流程破的案"；
- S 篇收官：你已有能力独立调试任何裸机疑难。

<div class="achievement">
✅ S 篇收官。下一站：<a href="../rtos/index.html">RTOS 篇</a>——从"一个超级循环"到"多个平行世界"，先看 FreeRTOS 怎么变魔术。
</div>
