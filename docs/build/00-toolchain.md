---
title: B0 工具链全景：四个软件一台戏
status: building
difficulty: 2
minutes: 25
---

# B0 工具链全景：交叉编译四件套各管什么

> 🎯 你电脑是 x86 的，芯片是 ARM 的——在"鸡"上孵"鸭"蛋，这就是交叉编译。负责孵蛋的是一套叫 toolchain 的组合拳：gcc 翻译、binutils 打杂、gdb 看诊、newlib 供血。

## 本章精髓

1. "交叉"在哪：编译器本身跑在 x86-64（build），产出的机器码属于 ARM Cortex-M4（target）——`arm-none-eabi-` 前缀就是这个身份的铭牌。
2. 四件套分工：gcc（编译+链接调度）、binutils（as/ld/objcopy/objdump/nm/readelf）、gdb（调试）、newlib（给裸机用的精简 C 库）。
3. 为什么裸机不能用 glibc：没有 Linux 系统调用，printf 的"输出"都不知往哪去——newlib 允许你只实现几个 `_write` 钩子就把 printf 接到串口（S7 实操）。

## 学习目标

- 说出四件套各自职责与至少一个代表工具。
- 解释 `arm-none-eabi` 三段命名的含义（arch-vendor-os/abi）。
- 在电脑上找出自己安装的 gcc 内建头文件/specs 的位置（`arm-none-eabi-gcc -print-search-dirs`）。

## 先修

- 无（建议与 [S0](../stm32/00-env.md) 的安装步骤对照）。

## 先跑起来（10 分钟 quick win）

跑这两条，把工具链的"五脏六腑"看个大概：

```bash
arm-none-eabi-gcc -print-search-dirs     # 它去哪儿找库和头文件
arm-none-eabi-gcc -dumpspecs | more      # gcc 内部的"调度剧本"
```

## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| 交叉编译是什么 | build/host/target 三胞胎；为什么不能直接用系统 gcc | 配置 |
| binutils 兵器谱 | as/ld/ar/nm/objcopy/objdump/readelf/strings 各一招鲜 | 库解析 |
| newlib 与钩子 | `_write/_sbrk` 钩子机制预览（S7 printf 重定向的伏笔） | 库解析 |
| 版本与来源 | Arm GNU Toolchain 官方发行；为什么别用"打包版杂牌军" | 配置 |

## 记忆锚点

::: tip 一句话记住
**gcc 是总指挥，binutils 是七件兵器，newlib 是裸机口粮，gdb 是随队医生**——前缀 `arm-none-eabi-` 就是他们的工牌。
:::

## 实物实验

- 对 00-blink 的 `build/blink.elf` 连发四枪：`nm`（看符号）、`objdump -h`（看段）、`readelf -l`（看加载段）、`objcopy -O binary`（出 bin）——每枪都在 B2/B5 展开。

## 常见坑

- **混用多个工具链**：系统里装了 Arm 官方版又装了某 IDE 捆绑版，PATH 谁前用谁——`where arm-none-eabi-gcc` 查一下。
- **工具链与目标不匹配**：拿 `arm-linux-gnueabihf-gcc`（跑 Linux 的）编裸机，启动文件/库全不对。
- **把 binutils 当 gcc 附属品**：实际上读固件 80% 靠 binutils，B2/B5 两章全是它们的戏份。

## 你做到了

- 工具链从"一坨 exe"变成职责分明的四件套；
- 会查 gcc 的搜索路径和调度剧本，环境问题能自救。

<div class="achievement">
✅ 下一站：<a href="01-four-steps.html">B1 四步构建</a>——把 main.c 一步步变成机器码，中间产物全留下。
</div>
