---
title: 更新日志
---

# 更新日志

> 🎯 一个教程最怕"看起来写完了"。这一页把每次改了什么、哪些坑还开着写清楚——未完成的部分站内一律标"建设中"。

站点统计（成稿章节 / 实验 / 动画 / 工程数）由 `npm run docs:gen` 扫描全站章节 frontmatter 得出，[首页学习地图](/)与本页同源。

## 2026-10-06 · 动画可执行化 + B2/C1 成稿

- **29 张教学动画全部过两道机器闸门**：`npm run anim:lint`（SMIL 槽位、色板映射、`dur` 整除、指示点越界）零告警；`scripts/anim-audit.html` 逐阶段量"出界 / 压字"零命中。规范落在 `.trellis/spec/docs-site/animation.md`。
- **`gd32-rcu-clock.svg` 从幻灯片改成动画**：原先只有四个阶段互相切换，现在每个阶段的时钟路由被逐点爬通（IRC16M→CK_AHB、HXTAL→PLL、电压档→PLL、PLL→三个分频口、CK_AHB→CK_OUT0→PA8），晶振与电压档盒子带节拍抖动，PLL 锁定后 APB1/APB2 各有一颗节拍常驻往返；两条脚注拆进 720 画布。
- **顺带揪出三处同排压字**：`context-switch`（`psp 存进 TCB_A` 与栈帧说明挤在同一行）、`uart-frame`（帧说明与位标注基线只差 8px）、`usart-txe-tc`（TXE 说明与反例文字重叠 34px）。只动坐标与锚点，配色与节拍未改。
- **B2 ELF 解剖成稿**：`readelf`/`objdump`/`nm` 五刀拆 `blink.elf` 与刻意留脏的 `elf_probe.elf`，34,604 字节 ELF 与 660 字节 bin、`.data` 的 `FileSiz=0x0c` 对 `MemSiz=0x20`、91 个中断弱别名、`readelf -s` 与 `nm` 的那个 ±1 全部是量出来的；取证工程 `code/toolchain/02-elf/probe.sh` 不要开发板也不要 make。
- **C1 内存模型成稿**：五段论 → 一个全局变量的三段旅程（源码 → ELF 双地址 → 上电搬运）→ `const` 经济学 → `nm`/map 审计，配套 `code/c/01-memory-model/probe.sh` 双工具链取证。
- **修掉 S2 工程里的一处真 bug**：`code/stm32/01-rcc-clock/main.c` 的 `mco1_init()` 把 `MCO1PRE` 按"分频比 − 1"编码，`/4` 写成 `0b011`——那一位落在**不分频**区，PA8 实际吐 168MHz，本章 42MHz 的对账本来不成立。改成显式映射表（/1 /2 /3 /4 /5 → 编码 0/4/5/6/7，依据 ST HAL `RCC_MCODIV_1..5`，`stm32f4xx_hal_rcc.h:314-318` @`1f6451c`）；默认与 `USE_HSE_PLL=1` 两档构建复编通过。同批把 G1 工程的 `clock_tree_readback()` 改成按 `SCSS` 如实解码时钟源、按 `RCU_PLL` 参数重算频率——回退路径不再由调用方传"自己以为的那一档"。
- 尚开着的坑：`00-blink` 六变体的板上现象、`CK_OUT0`/`MCO1` 的示波器实测值仍待接板回填。

## 2026-10-06 · 读者侧升级

- **章节元数据体系**：74 个章节页统一加 `status`（done/building）、`difficulty`（入门/进阶/硬核）、`minutes`（预计学习时长）三项 frontmatter；`scripts/gen-progress.mjs` 由此算出全站进度，取代原先散落在 README、首页与贡献指南里的手写数字（三处曾各说各话）。
- **首页学习地图**：新增 `LearningMap` 组件——按板块显示成稿进度条与章节胶囊，实心=成稿、虚线=建设中；顶部统计条一次给出成稿/实验/动画/工程与通读时长。
- **按身份分流**：首页新增五条上路方式（零基础 / 会 C 玩过 Arduino / 硬件出身 / 做 AIoT / 被 RTOS 卡住），替代原先按"最新成稿"排的表。
- **读者支撑页**：新增 [术语速查](/reference/glossary.md)（按板块分组的名词卡，每词条 = 一句话 + 常见误解 + 深读去处）、[FAQ](/reference/faq.md)、[关于我们与致谢](/reference/about.md)、本页。
- **站内搜索**：开启 VitePress 本地搜索，中文正文可直接搜寄存器名、引脚号与术语。

## 2026-10-06 · C3 volatile 成稿（含本站自我勘误）

- **C3 volatile 成稿**：as-if 授权书 → 四个现场取证 → 管/不管清单 → CMSIS `__IO` 与 SPL `__IO` 的对照读码 → `00-blink` 三处 volatile 逐行 → 临界区/屏障/cache 补边界；配套动画 `volatile-as-if.svg` 与零硬件取证工程 `code/c/03-volatile/`。
- **两套工具链取证**：宿主 gcc 16.1.0（x86-64）与 `arm-none-eabi-gcc 15.2.1`（`-mcpu=cortex-m4`）各跑一遍，四个现场的正反汇编全部进正文；`blink-variants.sh` 一次生成六个 `00-blink` 变体。
- **勘误一（本站写错）**：初版写"去掉 `delay` 参数的 `volatile`，`-O2` 灯就不闪"——实测不成立，循环体的 `__asm__ volatile ("nop")` 是另一道独立防线，必须连 `nop` 一起删才翻车。已改写正文与"常见坑"。
- **勘误二（新发现的实测事实）**：寄存器宏漏 `volatile` 的后果不是"写被折叠"，而是**顺序倒置**——`-O2` 下 `GPIOF_MODER` 的读被排到 `RCC_AHB1ENR` 的写之前；三处 volatile 全去时 `main` 直接塌成一条 `b.n 0`（所有外设写被当死 store 删除）。
- 尚开着的坑：`00-blink` 六变体的**板上肉眼现象与 PF6 波形**待接板回填（本轮只做到编译期）。

## 2026-10-06 · GD32 双系路线建档

- 官方一手源码入库（GD32F4xx 库 V3.3.3 `@10d02f4`、GD32VF103 `@7ab0521`、Bumblebee Core 手册）；
- **G1 RCU 时钟树成稿**：200MHz 是怎么算出来的，与 S2 逐字段对照，含 `CK_OUT0` 对账与"官方库空转轮询"的源码瑕疵记录；配套 `gd32-rcu-clock.svg` 动画与 `code/gd32/01-rcu-clock` 寄存器级工程。
- 尚开着的坑：FMC 等待周期"频率↔档位"对照表**待用户手册核验**；CK_OUT0 输出 50MHz **待上板实测**。

## 2026-10-06 · 三路线十章成稿

- STM32：S2 RCC 时钟树、S6 定时器 TIM、S7 USART、S8 DMA；
- FreeRTOS：F1 任务与 TCB、F6 通知/事件/软件定时器、F7 内存管理；
- ESP32-S3：P2 GPIO 矩阵、P5 UART 驱动、P7 定时器与 LEDC；
- 配套动画 14 张（新增 13 + 修订 DMA 乒乓）、工程 7 个（STM32 裸机 ×3、FreeRTOS 五场景、IDF ×3）。

## 2026-10-06 · 内核源码级四篇

- S11 I2C、F3 调度器、F4 队列、F5 信号量与互斥：全部以 SPL 与 FreeRTOS V11.1.0 原文行号引证；
- 新增 `priority-inversion`、`spi-timing` 动画与两支已验证的 B 站视频；
- 阅读体验：中文正文行距、品牌表头与斑马纹、【注】与答题卡样式、首页成稿引导带；favicon 修复 `/favicon.ico` 404。

## 2026-10-06 · 起点

- VitePress 站点与七板块深度大纲、双路线第 0 章（S0/P0）、实验中心模板与 E01–E03；
- S3 GPIO、B4 启动过程、F2 上下文切换成稿 + 8 张动画 + 视频嵌入组件；
- 接入 GitHub Pages（`base: /mcu/`），编辑链接与部署工作流上线。

## 下一步

按依赖顺序推进骨架章成稿：C 篇（地基，尤其 C2 指针与 C6 栈帧）→ B 篇剩余（B1/B3）→ S 篇中断与外设（S4 NVIC、S12 SPI、S16 HardFault）→ RT-Thread 全线。实验 E04–E08 的实测数据回填（电流、波形参数）与实物照片补齐同批进行。

想接手哪一篇，去 [仓库 Issue](https://github.com/zhuguang-ZFG/mcu/issues) 认领即可。
