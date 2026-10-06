---
title: R6 Env 与 menuconfig：RT-Thread 的点单系统
status: building
difficulty: 1
minutes: 25
---

# R6 Env、scons 与 menuconfig：配置即代码

> 🎯 RT-Thread 生态的恐怖之处：menuconfig 里勾一个"MQTT 客户端"，`pkgs --update` 一敲，源码自动下载、自动进构建——像点外卖。这背后是 Env（工具环境）+ scons（构建）+ Kconfig（配置）的三人转。

## 本章精髓

1. Kconfig 管"编什么"：每个组件/软件包自带 Kconfig 描述依赖与选项，`menuconfig` 生成 `.config`→`rtconfig.h`——**菜单项=宏**，代码里 `#ifdef` 应声而开（与 ESP-IDF 同源，对照 [P3](../../esp32/03-idf-anatomy.md)）。
2. scons 管"怎么编"：SConstruct/SConscript（Python）描述源码清单与依赖，`scons -j8` 出固件；`scons --target=mdk5/iar` 还能一键导出 IDE 工程——源码是单一事实源。
3. Env 是"开箱即用"的 Windows 环境：内置 Python/scons/gcc/menuconfig——装一个 Env，全站工具零配置（与 P0 的 IDF 安装器同思路）。

## 学习目标

- 完成一次完整流程：menuconfig 勾选软件包→pkgs --update 拉源码→scons 构建→烧录验证。
- 读懂 BSP 目录结构：board/（板级）+ libraries/（HAL/驱动）+ applications/（应用）+ Kconfig。
- 为一个自写组件补一个 Kconfig 选项并在 menuconfig 里出现。

## 先修

- [B7 构建系统](../../build/07-build-system.md)（CMake/scons/Kconfig 对照锚点）。

## 先跑起来（10 分钟 quick win）

BSP 目录下 `menuconfig`：方向键翻菜单，空格勾选——保存退出后 `scons -j8`，新组件已进固件。配置驱动开发，第一次体感。

## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| Env 安装与命令 | env 控制台；menuconfig/pkgs/scons 三板斧 | 配置 |
| Kconfig 机制 | config 项→.config→rtconfig.h 的宏链路 | 库解析 |
| scons 构建 | SConscript 逐行：源文件分组与依赖 | 库解析 |
| 软件包生态 | 在线包索引/版本选择/离线包处理 | 配置 |
| BSP 解剖 | board/libraries/applications 三区职责 | 库解析 |
| 对比 IDF | Kconfig 同源、构建异构（CMake vs scons）的取舍 | 库解析 |

## 记忆锚点

::: tip 一句话记住
**menuconfig 点单，pkgs 取货，scons 下厨；Kconfig 管编什么，scons 管怎么编——点外卖式做固件。**
:::

## 实物实验

- 勾一个软件包（如 cJSON）→ 应用里 `#include "cJSON.h"` 解析一段 JSON 串口打印——从零到用上社区库，十分钟。

## 常见坑

- **menuconfig 保存后忘 scons 重编**：宏已变固件未新——"勾了没用"的第一原因。
- **pkgs --update 网络失败**：代理/镜像问题——pkgs 支持镜像源配置，公司网先配好。
- **Kconfig 依赖断链**：选项灰着选不上=父依赖没开——按 ? 看依赖表达式。
- **在 applications 里改驱动**：改板级驱动请去 board/ 与 libraries/——applications 只放应用，否则换 BSP 全丢。

## 你做到了

- RT-Thread 生态的"点单-取货-下厨"全流程跑通；
- 配置体系与构建体系的分工彻底清晰——B7 的理论在此落地。

<div class="achievement">
✅ 下一站：<a href="07-port-f407.html">R7 移植到霸天虎</a>——Nano 手动移植到标准版，两步走全记录。
</div>
