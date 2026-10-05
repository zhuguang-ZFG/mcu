---
title: P10 Flash、分区表、NVS 与 OTA
---

# P10 16MB 的版图：分区表、NVS 与 OTA

> 🎯 STM32 的 Flash 布局是你链接脚本里画的；ESP32 的 16MB Flash 归一张 **CSV 分区表** 管：哪块放 bootloader、哪块放 app、哪块存参数——而 OTA 的全部秘密，就是"两个 app 分区轮流坐庄 + 一个 otadata 记票"。

## 本章精髓

1. 分区表 CSV 逐字段：name/type/subtype/offset/size/flags——`factory`（出厂 app）、`ota_0/ota_1`（升级候选）、`nvs`（键值存储）、`phy_init`（射频校准）、`spiffs/fatfs`（文件系统）——16MB 的每一 KB 都有户口。
2. NVS 是"磨损均衡的键值库"：nvs_set/get 背后是按页管理+CRC 校验+掉电安全的迷你文件系统——Wi-Fi 凭据、设备配置、计数器的标准住所（别再自己写 Flash 扇区了，对照 [S13](../stm32/13-flash-iap.md) 的手工方案）。
3. OTA 双槽机制：新固件写进另一个 ota 分区→校验→otadata 指向新槽→重启→**新固件自检通过后 esp_ota_mark_app_valid**，否则下次启动自动回滚旧槽——"防变砖"不是口号，是这套状态机。

## 学习目标

- 读懂并修改 partitions.csv：为项目重划 app/nvs/存储区大小，`idf.py partition-table` 验证。
- 用 NVS 实现"断电记住运行次数"，并解释页满后的自动整理行为。
- 走通本地 OTA 流程：改版本号→新 bin→写入 ota 槽→切换→回滚演示（故意让新固件不 mark valid）。

## 先修

- [P1 启动](01-arch-boot.md)（分区表登场）、[S13 Flash](../stm32/13-flash-iap.md)（手工方案对照）。

## 先跑起来（10 分钟 quick win）

hello 工程加 NVS：每次启动 `boot_count++` 存回，断电重启后打印——你的第一笔"持久化资产"。

## 板卡事实

- 立创实战派 S3：16MB Flash（N16R8 模组），默认分区表多为 factory + 大容量存储区布局——以 `idf.py partition-table` 实际读出为准。

## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| CSV 逐字段 | 默认表逐行；offset 对齐与 size 约束 | 配置 |
| NVS 机制 | 页/条目/CRC；命名空间与类型 API | 库解析 |
| boot_count 实战 | 掉电持久化最小例 | 代码分析 |
| OTA 状态机 | 双槽+otadata+valid/pending 状态全图 | 库解析 |
| 本地 OTA 演练 | 版本号/切槽/回滚三步实操 | 代码分析 |
| 安全选项 | Flash 加密与安全启动的概念地图（生产话题） | 配置 |

## 记忆锚点

::: tip 一句话记住
**分区表是地产证，NVS 是带掉电保护的抽屉，OTA 是双槽轮流坐庄——新固件不自证清白，旧槽随时复位。**
:::

## 实物实验

- 本地 OTA 全流程 + 故意"不标 valid"看自动回滚——亲手验证防变砖机制（日志存档）。

## 常见坑

- **app 超分区大小**：build 过但烧录/启动失败——改 CSV 给 app 扩容或开 -Os 瘦身（B5 方法）。
- **nvs 当高频日志存储**：Flash 寿命按擦写次数计——高频数据先入 RAM 定期落盘。
- **OTA 后忘调 mark_valid**：新固件跑挺欢，重启回旧版——自检+标记是 OTA 的最后一公里。
- **分区表与 boot 不同步**：改了 CSV 只烧 app——`idf.py flash` 全套重烧解决。

## 你做到了

- 16MB 的每一寸都归你规划；
- 持久化与远程升级两大产品能力原理到手——小智板离"产品"只差你的应用。

<div class="achievement">
✅ 下一站：<a href="11-lowpower.html">P11 低功耗</a>——睡眠矩阵、ULP 与电流实测。
</div>
