---
title: P7 定时器与 LEDC：各管一段时间
---

# P7 定时器与 LEDC：GPTimer 计时，LEDC 调光

> 🎯 STM32 里 TIM 一肩挑（时基+PWM）；ESP32-S3 把两件事分给了两个外设：**GPTimer** 管"什么时候叫我"（高精度报警），**LEDC** 管"以什么节奏眨眼"（PWM 调光调速）。分工即选型。

## 本章精髓

1. GPTimer 是"闹钟工厂"：计数器+报警值，到点回调——回调跑在 ISR 上下文（IRAM 纪律回 P4），微秒级分辨率，适合测距、超时、采样节拍。
2. LEDC 是"16 路 PWM 乐团"：定时器（速度组+分辨率）与通道（绑定 GPIO+占空比）两级配置——占空比渐变用硬件 `ledc_fade`（无需 CPU 逐点写），这是它比"定时器模拟 PWM"高级的地方。
3. 分辨率×频率是此消彼长：duty_resolution 位数越高，可达频率越低（f = 时钟/2^bits）——舵机 50Hz 可上 14 位，音频级应用就得降位数。

## 学习目标

- 背出 LEDC 两级配置链：timer_config（频率/分辨率/速度组）→ channel_config（GPIO/通道/占空比）。
- 用硬件 fade 做呼吸灯与屏幕背光调光，逻辑分析仪验证占空比线性度。
- 用 GPTimer 报警回调实现 1kHz 采样节拍，与 vTaskDelay 版做抖动对比。

## 先修

- [S6 TIM](../stm32/06-tim.md)（PWM 本质）、[P2 引脚](02-gpio-matrix.md)、[P4 中断](04-irq-dualcore.md)。

## 先跑起来（10 分钟 quick win）

LEDC 通道绑到背光引脚（以立创 wiki 为准）：`ledc_set_duty` + `ledc_update_duty`，屏幕从暗到亮——占空比的物理意义第一次"看得见"。

## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| GPTimer 报警 | gptimer_config/ alarm 回调；ISR 上下文纪律 | 配置 |
| 采样节拍 | 1kHz 定时 vs vTaskDelay 抖动实测 | 代码分析 |
| LEDC 两级 | timer/channel 配置逐字段；速度组的时钟源 | 配置 |
| 硬件渐变 | ledc_fade 系列；阻塞/非阻塞两模式 | 代码分析 |
| 分辨率取舍 | 频率-位数换算表；舵机/背光/音频案例 | 配置 |
| 对照 TIM | STM32 TIM 一肩挑 vs S3 分工设计的哲学 | 库解析 |

## 记忆锚点

::: tip 一句话记住
**GPTimer 定闹钟（ISR 里快办事），LEDC 开乐团（timer 定调 channel 发声）；渐变交给硬件 fade，位数频率跷跷板。**
:::

## 实物实验

- 背光呼吸 + [E03 分析仪看占空比](../lab/e03-scope-pwm.md) 的 S3 版：fade 曲线抓取，验证硬件渐变的线性/伽马差异。

## 常见坑

- **改 duty 忘 update**：LEDC 双缓冲——`ledc_update_duty` 才装载（与 TIM 直接写 CCR 不同）。
- **fade 与手动 set 混用**：渐变途中手动 set 被 fade 引擎覆盖——停 fade 再接管。
- **速度组时钟源选错**：低速组（LS）在高频需求下给不出——高频用 APB 时钟源的高速配置。
- **GPTimer 回调里做长活**：回调=ISR——阻塞一毫，系统抖一分（P4 复训）。

## 你做到了

- S3 的"时间双雄"各就各位；
- PWM 从"能用"到"用好"：fade、分辨率、速度组全在掌握。

<div class="achievement">
✅ 下一站：<a href="08-wifi.html">P8 Wi-Fi 精髓</a>——esp_event 事件循环与连接状态机，联网的第一性原理。
</div>
