---
title: P8 Wi-Fi 精髓：事件循环与连接状态机
---

# P8 Wi-Fi 精髓：从 esp_wifi_init 到拿到 IP

> 🎯 新手写 Wi-Fi：`esp_wifi_connect()` 之后 `while(1);` 干等，连上了靠运气，断线了干瞪眼。高手只信一件事：**Wi-Fi 是个状态机，事件循环是它的语音播报**——听懂播报（WIFI_EVENT/IP_EVENT），就掌握了联网的第一性原理。

## 本章精髓

1. esp_event 是 IDF 的"神经系统"：事件循环任务（默认 loop）+ 事件基（WIFI_EVENT/IP_EVENT）+ 注册回调——驱动/协议栈出事件，你的代码只响应，不轮询（这就是"事件驱动架构"，与 [P5](05-uart-driver.md) 的驱动事件同思想）。
2. 连接状态机就六个状态：init→config→start→connect→(SCAN_DONE/AUTH/DISASSOC 中间态)→GOT_IP——`WIFI_EVENT_STA_DISCONNECTED` 必须处理**重连策略**，否则路由器一重启设备就永远离线。
3. LwIP 在幕后：拿到 IP 后才有 socket——`IP_EVENT_STA_GOT_IP` 是"网络可用"的唯一合法起点，之前调 connect() 都是空气。

## 学习目标

- 写出"教科书骨架"：nvs_init→netif_init→event_loop→wifi_init→注册回调→start→connect，并说出每步失败后果。
- 实现带指数退避的重连（断线后 1s/2s/4s…上限 60s），并用路由器重启实测。
- 解释 handler 运行在事件任务上下文，为什么不能阻塞（与守护任务纪律同构）。

## 先修

- [F6 事件思想](../rtos/freertos/06-notify-event-timer.md)、[P3 Kconfig](03-idf-anatomy.md)（Wi-Fi 配置项）。

## 先跑起来（10 分钟 quick win）

menuconfig 填上 Wi-Fi 账号密码（示例工程惯例），`idf.py flash monitor`：观察日志从 `wifi:state: init` 到 `got ip` 的完整旅程——把日志与状态机逐条对号入座。

## 动画：从 WiFi 握手到 TCP 三次握手

先拿"小区门禁卡"（关联+DHCP 得 IP），再和服务器对暗号：SYN(seq=100) → SYN+ACK(seq=300,ack=101) → ACK(ack=301)。**三次才能证明双向耳聪目明**——序号是防迟到旧报文骗开门的。

![TCP 握手动画](/anim/tcp-handshake.svg)

## 配套视频

<VideoEmbed type="youtube" id="gOW-B2KHvHU" title="TCP 3-Way Handshake Explained（3 分钟动画，和上图逐帧对照）" />


## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| 事件循环 | esp_event 架构；默认 loop vs 自建 loop | 库解析 |
| 骨架六步 | 教科书代码逐行；每步的错误码含义 | 代码分析 |
| 事件全表 | WIFI_EVENT_*/IP_EVENT_* 速查与触发时机 | 配置 |
| 重连策略 | DISCONNECTED 的原因码；退避算法实现 | 代码分析 |
| NVS 与校准 | Wi-Fi 为什么需要 NVS（射频校准数据） | 配置 |
| 状态机对照 | 日志级别调高看协议栈内部状态迁移 | 库解析 |

## 记忆锚点

::: tip 一句话记住
**Wi-Fi 是状态机，事件循环是播报员；GOT_IP 才算联网，DISCONNECTED 必须安排后路。**
:::

## 实物实验

- 重连实测：连上后重启路由器，日志记录断连检测耗时与重连成功耗时——"可用性"第一次被量化。

## 常见坑

- **handler 里阻塞重连**：事件任务被堵，后续事件全丢——重连用任务/定时器外置。
- **忘 nvs_flash_init**：Wi-Fi 校准数据无处安放，初始化直接报错（新手第一条报错信息）。
- **ssid/password 硬编码进仓库**：凭据泄漏事故——menuconfig/构建注入（P3 的 Kconfig 自定义）。
- **多网卡混淆**：STA+AP 双模时 netif 选错——esp_netif 句柄按模式分清。

## 你做到了

- 联网从"玄学调用"变成"状态机+事件"的可推理系统；
- 断线重连这个 99% 教程跳过的生产问题，你有了解法。

<div class="achievement">
✅ 下一站：<a href="09-bt-espnow.html">P9 蓝牙与 ESP-NOW</a>——无路由直连的另一种可能。
</div>
