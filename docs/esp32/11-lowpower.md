---
title: P11 低功耗：睡眠矩阵与 ULP
---

# P11 低功耗：Deep Sleep 之后，谁还记得你

> 🎯 Wi-Fi 芯片谈低功耗像让短跑运动员学睡觉——但只要搞清楚"睡多深、谁叫醒、醒来剩什么"，电池供电的 ESP32 产品依然成立：Deep Sleep 下 µA 级，ULP 协处理器替你站岗。

## 本章精髓

1. 睡眠矩阵：Light sleep（CPU 暂停、RAM 保持、外设可唤醒，ms 级回神）vs Deep sleep（数字域断电，只留 RTC 域，µA 级，**唤醒=复位重启**）——对照 [S14](../stm32/14-pwr.md) 的三档，哲学相同，ESP 的 RTC 域戏份更重。
2. 唤醒源全家桶：定时器（esp_sleep_enable_timer_wakeup）、GPIO/EXT0/EXT1、触摸、UART、ULP——唤醒源决定系统怎么设计（定时上报选定时器，按键唤醒选 EXT）。
3. ULP 协处理器是"守夜人"：主核睡死时，这颗超低功耗小核可跑简单程序（读 ADC/I2C、数脉冲）——达到阈值才唤醒主核，电池产品的终极杀器（FSM/RISC-V 两代 ULP 简介）。

## 学习目标

- 背出 Light/Deep 在"RAM/外设/唤醒方式/唤醒后状态"四列的差异。
- 实现 Deep sleep + 定时唤醒的周期上报器，并用 RTC 内存（RTC_DATA_ATTR）跨复位保存计数。
- 电流实测：活跃/Light/Deep 三档记录（[E06](../lab/e06-lowpower-current.md) S3 版）。

## 先修

- [S14 低功耗](../stm32/14-pwr.md)（对照）、[P10 NVS](10-flash-nvs-ota.md)（持久化分工）。

## 先跑起来（10 分钟 quick win）

`esp_sleep_enable_timer_wakeup(5s)` + `esp_deep_sleep_start()`：5 秒后自动复位，串口打印 RTC 内存里的计数——睡-醒循环第一次跑通。

## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| 睡眠矩阵 | Light/Deep 四列对照；与 STM32 三档对表 | 配置 |
| RTC 内存与慢速内存 | RTC_DATA_ATTR/RTC_SLOW 的存放规则 | 代码分析 |
| 唤醒源配置 | 定时器/EXT0/EXT1/触摸/UART 逐个 | 配置 |
| 周期上报器 | 醒来→采数据→发 Wi-Fi→再睡的完整骨架 | 代码分析 |
| ULP 概念 | 两代 ULP 能力；适用场景与开发流程地图 | 库解析 |
| 电流实测 | 三档电流记录与续航估算（CR2032/18650 两例） | 代码分析 |

## 记忆锚点

::: tip 一句话记住
**Light 眯一会（记忆在），Deep 睡死（靠 RTC 留遗言），ULP 守夜看门——唤醒即复位，状态藏 RTC。**
:::

## 实物实验

- 周期上报器 + 电流三档实测；进阶：GPIO 唤醒（用户键）与定时唤醒并存，分辨唤醒原因（esp_sleep_get_wakeup_cause）。

## 常见坑

- **Deep sleep 后找变量**：普通 RAM 已失电——跨 sleep 状态必须 RTC_DATA_ATTR 或 NVS。
- **Wi-Fi 没关就睡**：射频/协议栈在跑，电流下不来——睡前 esp_wifi_stop/disconnect。
- **GPIO 唤醒脚选错**：Deep sleep 只有 RTC GPIO 能唤醒——查 TRM 的 RTC 引脚清单。
- **ULP 当主核用**：ULP 算力/内存极小——它只适合做"阈值哨兵"，别让它干业务。

## 你做到了

- 电池供电 ESP32 产品的全套低功耗工具到手；
- S/P 两篇低功耗观完成对照——"睡觉"这门学问你现在是双学位。

<div class="achievement">
✅ 下一站：<a href="12-audio-path.html">P12 音频链路</a>——ES8311+ES7210：小智板的看家本领，从 I2S 时序到"hello 语音"。
</div>
