---
title: B6 烧录与调试：SWD 与断点的真相
---

# B6 烧录与调试：两根线如何统治一颗芯片

> 🎯 烧录和调试看起来像两个功能，其实是同一件事：通过 SWD 两根线，直接读写芯片的内存、寄存器，甚至让它停下来。OpenOCD 和 GDB 只是这对"超能力"的两个客户端。

## 本章精髓

1. SWD 只有三根线（SWDIO/SWCLK/GND）：一套请求-响应协议，读写一个叫 DP（调试端口）的家伙，再由 AP（访问端口）摸到整个地址空间——**CPU 跑不跑都能摸**。
2. 烧录=主机帮你执行擦写：OpenOCD 把一小段"擦写算法"灌进 RAM，让它替自己干活（所以 program 命令要选对 target 配置）。
3. 断点有两副面孔：硬件断点（FPB 比较器，数量有限，Flash 里也能下）vs 软件断点（改写成 BKPT 指令，RAM 才行，数量不限）——GDB 的 `hbreak` 与 `break` 由此分家。

## 学习目标

- 画出"PC→OpenOCD→ST-Link→SWD→DP/AP→总线"的链路，并指出 program 命令在每一环干什么。
- 完成一次 GDB 实战：halt、读写内存、单步、软硬断点各一次。
- 解释为什么 Flash 里的代码用 `break` 有时失败而 `hbreak` 总能成。

## 先修

- [B4 启动过程](04-startup.md)；[S0](../stm32/00-env.md)（环境已就绪）。

## 先跑起来（10 分钟 quick win）

```bash
make debug &        # OpenOCD 常驻
make gdb            # 连上即：reset halt → load → break main → continue
```

GDB 里再玩三招：`x/4xw 0x20000000`（读 RAM）、`set {int}0x20000000 = 0x1234`、`hbreak main`。

## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| 链路全图 | PC/OpenOCD/ST-Link/SWD/DP/AP 逐环讲 | 配置 |
| program 拆解 | OpenOCD 日志逐行：halt→擦→写→verify→reset | 库解析 |
| GDB 十命令 | target remote/load/monitor/x/set/si/break/hbreak/info reg/continue | 代码分析 |
| 断点的硬件 | FPB 比较器 vs BKPT 改写；各 6 个的限额从哪来 | 库解析 |
| Semihosting 一瞥 | 让 printf 走调试通道回 PC——原理与代价（S7 的替代方案） | 库解析 |

## 记忆锚点

::: tip 一句话记住
**SWD 两线通天，CPU 停不停都能读写；烧录是请 RAM 里的算法代劳，断点分软硬——Flash 用硬，RAM 随意。**
:::

## 实物实验

- `monitor flash erase_sector 0 0 0` 擦掉首扇区再复位：板子不闪了（固件没了）；重新 `make flash` 救回——体验"烧录的本质是改内存"。

## 常见坑

- **GDB 连不上 3333**：OpenOCD 没常驻/防火墙拦/上一个 GDB 没退（`target remote` 是 TCP 连接）。
- **load 之后跑飞**：忘了 `monitor reset halt` 就 continue——芯片可能已在乱跑。
- **硬件断点用完**：`break` 在 Flash 区域悄悄占用 FPB 槽位（通常 6 个），超了报错——清旧断点或换软件断点思路。
- **ST-Link 固件过旧**：OpenOCD 报 SWD/JTAG 错误，用 ST 官方工具升级固件。

## 你做到了

- 烧录/调试从魔法变成一条讲得通的链路；
- GDB 十命令上手，软硬断点知道何时切换。

<div class="achievement">
✅ 下一站：<a href="07-build-system.html">B7 构建系统</a>——手写 Makefile 之后，看 CMake/Ninja 与 ESP-IDF、RT-Thread(scons) 怎么把它规模化。
</div>
