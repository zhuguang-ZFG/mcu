---
title: S2 RCC 时钟树：168MHz 是怎么算出来的
---

# S2 RCC 时钟树：168MHz 是怎么算出来的

> 🎯 时钟树是 STM32 的"配电网"：发电厂（HSE/HSI）→ 变电站（PLL 倍频）→ 输电线路（AHB/APB 分频）→ 每家每户的电表（外设使能位）。停电排查从电表开始——所以"先时钟、再模式、后数据"是我们的祖训。

## 本章精髓

1. PLL 公式一行写尽：`SYSCLK = HSE / M × N / P`——M 先把晶振分到 1MHz，N 倍频到 336MHz，P 再除以 2 得 168MHz；每个字母都是 RCC_PLLCFGR 里的一段位。
2. 分频有连锁反应：AHB（/1=168MHz）→ APB1（/4=42MHz）/APB2（/2=84MHz）；定时器还有"APB 分频≠1 时倍频×2"的隐藏规则——TIM 时钟 84/168MHz 由此而来（S6 要用）。
3. Flash 等得及吗：168MHz 下 Flash 取指要 5 个等待周期（FLASH_ACR.LATENCY）——不提频先提速会死机的物理原因。

## 学习目标

- 给定晶振频率，手算 PLL 的 M/N/P/Q 四参数并写出寄存器值。
- 按正确顺序配置提频全流程：开 HSE→等就绪→设等待周期→配 PLL→切换 SYSCLK→等切换完成。
- 用 MCO1 引脚把内部时钟"引出来"实测（示波器/逻辑分析仪）。

## 先修

- [S1 架构](01-arch.md)（AHB/APB 归属）；[C4 结构体](../c/04-struct-abi.md)。

## 先跑起来（10 分钟 quick win）

GDB 读 `RCC_CR`（0x40023800）与 `RCC_CFGR`（0x40023808）：复位默认值告诉你——芯片一出生就在跑 HSI 16MHz，PLL 还没上岗。

## 板卡事实

- 霸天虎 HSE 晶振频率以**霸天虎硬件规格书/原理图为准**（用时核对）；本章公式以 HSE=8MHz 与 25MHz 两例演示手算，套用时代入你核到的真实值。
- RCC 基址 0x40023800（RM0090 §7.3）；MCO1 引脚=PA8（datasheet 复用表 AF0）。

## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| 四个时钟源 | HSI/HSE/LSI/LSE 分工与精度对比 | 配置 |
| PLL 手算 | M/N/P/Q 逐段拆解；8M 与 25M 两例算到底 | 配置 |
| 提频六步 | 正确顺序 + 每步对应的寄存器位（HSEON/HSERDY/LATENCY/PLLSRC/PLLON/SW/SWS） | 代码分析 |
| MCO1 实测 | PA8 复用为 MCO1 输出 SYSCLK/分频，仪器验证 | 引脚 |
| SystemInit 对照 | SPL 的 system_stm32f4xx.c 如何实现同一流程 | 库解析 |

## 记忆锚点

::: tip 一句话记住
**先 M 后 N 再 P：晶振除 M 到 1M，乘 N 上三百，除 P 得 168；提速先加 Flash 等待，切完要看 SWS 回执。**
:::

## 实物实验

- MCO1 输出 SYSCLK/4（42MHz），逻辑分析仪测频验证 168MHz 真身；再切回 HSI 默认对比 16MHz——时钟树从图纸变成看得见的方波。

## 常见坑

- **忘配 Flash 等待周期就切 168MHz**：取指超时，直接跑飞——顺序：先 LATENCY，再切 SYSCLK。
- **PLLQ 忘了配**：USB OTG FS 要 48MHz（336/7=48），不配 PLLQ 插 USB 就枚举失败。
- **HSE 起振失败死等**： crystal 虚焊/负载电容不对时 HSERDY 永远不来——代码要加超时回退 HSI。
- **改了 PLL 忘更新 SystemCoreClock 变量**：SPL 的全局变量不更新，后面所有延时/波特率全错。

## 你做到了

- 时钟树从"一坨框图"变成会算会配的配电网；
- MCO1 实测给了你第一个"把内部信号引出来看"的技能。

<div class="achievement">
✅ 下一站：<a href="03-gpio.html">S3 GPIO</a>——七个寄存器位级图解，把 E01 那盏灯彻底讲透。
</div>
