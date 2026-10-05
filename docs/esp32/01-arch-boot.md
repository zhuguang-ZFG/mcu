---
title: P1 S3 架构与启动：从复位到 app_main
---

# P1 S3 架构与启动：bootloader→app 的接力赛

> 🎯 STM32 上电是"一条指令到 main"；ESP32-S3 上电是一场三棒接力：**ROM 引导 → 二级 bootloader → 你的 app**。多出来的两棒不是多余——它们换来了分区表、OTA、Flash 加密这些"出厂就是产品级"的能力。

## 本章精髓

1. 双核 LX7 + 内存分级：PRO_CPU/APP_CPU 两个核（FreeRTOS SMP），SRAM 分 IRAM（可执行）/DRAM（数据），外部 Flash 经 **Cache 映射**执行——代码实际从"缓存窗口"跑，这决定了"ISR 要放 IRAM"等一系列铁律（P4 展开）。
2. 三棒启动：ROM（固化，查 strapping 脚决定下载/启动模式）→ bootloader（二级：初始化 Flash/Cache，读分区表，选 app 并校验）→ app（FreeRTOS 初始化 → 创建 main task → 调你的 app_main）。
3. 分区表是"地产证"：bootloader 不烧死 app 地址，而是读分区表（CSV 定义 factory/ota/nvs/phy 等分区）——OTA 双 app 轮换、参数存储全靠这张表（P10 逐字段拆）。

## 学习目标

- 画出三棒启动流程图，并说出每棒失败时的兜底行为（如 app 校验失败回退）。
- 解释 IRAM/DRAM/Flash Cache 三者的关系，以及"代码在 Flash、运行在 Cache"的取指路径。
- 用 `idf.py partition-table` 读出 hello 工程的分区布局并逐行解释。

## 先修

- [P0 环境](00-env.md)；[B4 STM32 启动](../build/04-startup.md)（对照阅读效果最佳）。

## 先跑起来（10 分钟 quick win）

`idf.py monitor` 复位开发板，**逐行读启动日志**：从 `ESP-ROM:esp32s3` 到 `Hello!`——每一行日志对应接力赛的一棒，本章教你逐行翻译。

## 板卡事实

- 立创实战派 S3：模组 ESP32-S3-WROOM-1-N16R8（16MB Flash、8MB PSRAM、LX7 双核 240MHz）；strapping/下载相关引脚以立创 wiki 原理图为准。

## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| 启动日志逐行 | 真实日志逐行标注三棒分界 | 代码分析 |
| ROM 引导 | strapping 脚与下载模式；为什么按住 BOOT 才能烧 | 引脚 |
| 二级 bootloader | 初始化序列；分区表读取与 app 校验 | 库解析 |
| 内存地图 | IRAM/DRAM/DROM/IROM 与 Cache 窗口 | 配置 |
| FreeRTOS SMP | 双核初始化；main task 落在哪个核 | 库解析 |
| 与 STM32 对照 | "单文件启动" vs "三棒接力"的设计哲学 | 配置 |

## 记忆锚点

::: tip 一句话记住
**ROM 开门、bootloader 铺路、app 登场；代码住 Flash 跑在 Cache，地产全在分区表。**
:::

## 实物实验

- quick win 日志翻译 + 把 BOOT 键按住复位进入下载模式的日志对比——两种启动路径的第一手证据。

## 常见坑

- **改分区表忘烧分区表**：partitions.csv 改了只烧 app，布局没更新——`idf.py flash` 会一并烧，单烧 app 时注意。
- **把大数组放 DRAM 抱怨不够**：静态大缓冲考虑 PSRAM（8MB 在这呢）或 DROM——heap_caps 选型（P10/P11 联动）。
- **ISR 代码在 Flash 里**：Cache 关闭期间（写 Flash）取指失败崩溃——IRAM_ATTR 的纪律 P4 详讲。
- **以为 app_main 是裸 main**：它运行在 main task 里，返回即任务删除——系统还活着，别指望"return 复位"。

## 你做到了

- S3 启动的每一棒都讲得清、指得准；
- "出厂即产品级"的设计动机刻进脑子——OTA/分区在 P10 等你。

<div class="achievement">
✅ 下一站：<a href="02-gpio-matrix.html">P2 GPIO 与引脚矩阵</a>——为什么 S3 的引脚能"任意换岗"。
</div>
