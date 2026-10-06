---
title: R5 finsh 控制台：板子上的 shell
status: building
difficulty: 1
minutes: 25
---

# R5 finsh：在单片机上跑 shell 的原理

> 🎯 插根串口线，板子上敲 `list_thread` 回车——线程表跃然屏上。这不是 IDE 的专利，是 finsh：RT-Thread 自带的微型 shell。它的原理一句话：**把函数名和地址编进一张符号表，运行时按名调用**。

## 本章精髓

1. MSH_CMD_EXPORT 的魔法：宏展开=把一个 `{名字, 描述, 函数指针}` 结构体放进专用链接段（FsymTab）——链接器收齐，运行时 finsh 按名字段内查找并调用（链接段的又一神用，回 [B3](../../build/03-linker-script.md)/R0 自动初始化）。
2. 解析器极简：按空格切词→首词查符号表→参数逐个转换（支持整型/字符串）→按原型调用——所以命令的形参列表是受约束的。
3. list 系列的实现套路：`list_thread` 就是遍历对象容器（R0）+ 格式化打印——你会写 list，就会给自己的子系统加自检命令。

## 学习目标

- 写出 `MSH_CMD_EXPORT` 的宏展开等价代码，并在 map 文件里找到 FsymTab 段。
- 给工程加一个自定义命令（如 `led 1 on` 控制 RGB），串口实测。
- 解释 finsh 的两种模式（msh 命令行 vs finsh C 表达式风格）与裁剪选项。

## 先修

- [R0 对象模型](00-arch.md)、[S7 USART](../../stm32/07-usart.md)、[C5 函数指针](../../c/05-func-pointer.md)。

## 先跑起来（10 分钟 quick win）

串口终端连上 R7 移植工程：回车出 `msh />`，敲 `help`——全部命令清单立刻到手（自助文档系统）。

## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| 符号表机制 | MSH_CMD_EXPORT 宏展开与 FsymTab 段 | 库解析 |
| 解析与调用 | 切词/查表/类型转换/调用四步 | 库解析 |
| list 系列 | 对象容器遍历；给自己的子系统写 list 命令 | 代码分析 |
| 自定义命令 | `led` 命令完整实战（参数解析+错误提示） | 代码分析 |
| 裁剪与资源 | finsh 的 RAM/Flash 账；生产固件关不关 | 配置 |

## 记忆锚点

::: tip 一句话记住
**宏把函数钉进段里，shell 按名翻牌；help 即是文档，list 即是自检——finsh 是板子上的最小人机界面。**
:::

## 实物实验

- 自定义 `led` 命令 + 在 [E04](../../lab/e04-priority-inversion.md) 实验里用 finsh 动态改任务优先级（`rt_thread_control` 包一个命令）——现场调参不重烧。

## 常见坑

- **命令函数原型不符**：finsh 参数约定（int argc, char**argv）写错，调用即崩。
- **段被 gc-sections 回收**：FsymTab 段必须 KEEP——链接脚本少了它，命令"编译通过但 help 里没有"。
- **finsh 线程栈太小**：命令里调用深（如 list 带格式化打印）爆栈——finsh 栈单独预算（F7 方法）。
- **生产固件忘裁剪**：finsh 是调试利器也是攻击面——量产版 RT_DEBUG/FINSH 配置过一遍。

## 你做到了

- 板子有了"键盘鼠标"；
- 链接段技术第三次立功——你对它的运用已炉火纯青。

<div class="achievement">
✅ 下一站：<a href="06-env-menuconfig.html">R6 Env 与 menuconfig</a>——RT-Thread 的"点单系统"：scons 与 Kconfig。
</div>
