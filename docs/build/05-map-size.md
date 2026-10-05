---
title: B5 map 与体积：谁吃了我的 Flash
---

# B5 map 文件与体积审计：谁吃了我的 Flash/RAM

> 🎯 加了一个库，固件从 20KB 涨到 200KB——谁干的？map 文件就是"固件户口本"：每个符号多大、住哪、谁引进的，一查便知。嵌入式工程师的基本功：**先审账，再优化**。

## 本章精髓

1. `size` 的三列是三种资源：text（Flash：代码+只读）、data（Flash 存初值+RAM 住人）、bss（纯 RAM）——Flash 占用=text+data，RAM 占用=data+bss。
2. map 文件的三板斧：Archive member 表（谁被从库里捞出来）、Memory Map（每个符号的落位）、 discarded 段（被 gc-sections 辞退的）。
3. 优化的顺序：先看大项（库/表/缓冲区），再谈 -O 级别；方向错了 -O2 也救不了你。

## 学习目标

- 背出 Flash/RAM 占用公式并能用 size 输出心算验证。
- 在 blink.map 里找到 main.o 的落位记录与被 discarded 的段。
- 完成一次"揪出大尾巴"实战：找出固件里最占地方的三个符号。

## 先修

- [B2 ELF](02-elf.md)、[B3 链接脚本](03-linker-script.md)。

## 先跑起来（10 分钟 quick win）

```bash
arm-none-eabi-size build/blink.elf
arm-none-eabi-nm -S --size-sort build/blink.elf    # 符号按大小排，倒数五个就是大户
grep -A3 "Discarded input" build/blink.map | more  # 谁被辞退了
```

## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| size 三列 | Flash=text+data、RAM=data+bss 的推导与验证 | 配置 |
| map 三板斧 | Archive 表/Memory Map/Discarded 逐段实读 | 库解析 |
| nm 审计 | --size-sort 找大户；A/B/C 实验各一次 | 代码分析 |
| 瘦身工具箱 | -ffunction-sections+--gc-sections、-Os、去未用库、const 归位 | 配置 |
| CCM 腾挪 | 大缓冲搬进 CCM 的链接脚本配合（B3 联动） | 配置 |

## 记忆锚点

::: tip 一句话记住
**Flash=text+data，RAM=data+bss；优化先审账，nm 按大小排队，map 查户口本。**
:::

## 实物实验

- 实验三连：① 加一个 4KB 未初始化数组→看 bss 涨、Flash 不涨；② 改成带 `={...}` 初始化→data 涨、Flash/RAM 双涨；③ 加 `const`→data 回落、text 涨。三次 `size` 截图对比，规律亲手验证。

## 常见坑

- **bin 比 text+data 大**：bin 里段间空隙也占字节（按地址铺开）；hex 才是真"按需记录"。
- **Debug 信息背锅**：-g3 让 elf 巨大，但调试信息不进 Flash——烧录大小以 map/size 为准。
- **栈堆不算进 bss**：它们靠 `_Min_*` 预算段占位+运行时生长（B3）；爆 RAM 的另一种死法。
- **优化级别迷信**：-Os 通常赢 -O2（Flash 敏感场景）；但先砍大项再谈级别。

## 你做到了

- 固件体积在你眼里是一笔能逐条对账的账；
- 手握 size/nm/map 三把审计刀，优化不再靠猜。

<div class="achievement">
✅ 下一站：<a href="06-flash-debug.html">B6 烧录与调试</a>——SWD 两根线怎么把固件送进 Flash，断点凭什么让 CPU 停下。
</div>
