---
title: R0 RT-Thread 架构：万物皆对象
status: building
difficulty: 2
minutes: 30
---

# R0 RT-Thread 架构：分层与对象模型

> 🎯 如果说 FreeRTOS 是"瑞士军刀"（内核极致精简），RT-Thread 就是"工具箱"：内核之外自带设备框架、控制台、软件包生态。而理解这一切的钥匙只有一把——**万物皆对象**。

## 本章精髓

1. 三层架构：**内核层**（调度/IPC/内存，libcpu+BSP 之下）、**组件层**（finsh/设备框架/文件系统/网络）、**软件包**（社区三方，menuconfig 即点即用）——生态是它的护城河。
2. 对象模型是统一世界观：线程/信号量/互斥量/定时器/设备全部继承自 `rt_object`（名字+类型+标志）——`rt_object` 是"基类"，容器（object container）统一管理，所以 finsh 能 `list_thread`/`list_sem` 一把梭。
3. 自动初始化有"段位"：`rt_components_board_init` → `rt_components_init` → 应用——INIT_BOARD_EXPORT/INIT_COMPONENT_EXPORT 等宏把各层初始化函数按段排好，启动时依次执行（链接脚本段机制的教科书级应用，回 [B3](../../build/03-linker-script.md)）。

## 学习目标

- 画出 RT-Thread 三层架构图并标注每层代表文件/目录。
- 讲清 `rt_object`→`rt_thread` 的"继承"实现（C 语言结构体嵌套，回 [C4](../../c/04-struct-abi.md)）。
- 解释自动初始化机制：INIT_*_EXPORT 宏如何经链接段排布实现"免调用链"。

## 先修

- [F1~F3](../freertos/01-task-tcb.md)（内核概念对照锚点）；[C4](../../c/04-struct-abi.md)、[B3](../../build/03-linker-script.md)。

## 先跑起来（10 分钟 quick win）

打开 RT-Thread 源码 `include/rtdef.h` 找到 `struct rt_object` 与 `struct rt_thread`——亲眼看到"线程结构的第一个成员就是对象"，继承一目了然。

## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| 三层架构 | 内核/组件/软件包目录巡礼（src/components/packages） | 库解析 |
| 对象模型 | rt_object 基类与容器；list API 为什么万能 | 库解析 |
| 自动初始化 | INIT_*_EXPORT 段位表；与链接脚本的配合 | 库解析 |
| Nano vs 标准版 | 裁剪版与完整版的定位差；R7 移植选哪条路 | 配置 |
| 版本与许可 | 5.x 主线与 Apache-2.0；商业使用无负担 | 配置 |

## 记忆锚点

::: tip 一句话记住
**RTT 三层楼：内核打地基、组件当水电、软件包是家具；万物继承 rt_object，初始化按段自动排队。**
:::

## 实物实验

- 在 R7 移植工程上执行 finsh 命令 `list_thread`、`list_device`——对象模型的"户口本"直接打印在终端上。

## 常见坑

- **Nano 当标准版用**：Nano 没有设备框架/finsh——想要生态就上标准版（R6/R7）。
- **对象当线程用**：`rt_object` 是"概念基类"，直接操作它是糊涂账——走具体类型的 API。
- **自动初始化顺序误解**：段内顺序由链接顺序定——板级依赖关系错时表现为"设备没注册上"。

## 你做到了

- RT-Thread 的"世界观"成型：一张架构图 + 一个对象模型；
- 拿到对照学习的第二锚点——与 F 篇逐章对表开始。

<div class="achievement">
✅ 下一站：<a href="01-thread-sched.html">R1 线程与调度</a>——rt_thread 解剖与 256 级位图，和 FreeRTOS 逐项对照。
</div>
