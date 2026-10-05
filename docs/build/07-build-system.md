---
title: B7 构建系统：从手写 Makefile 到 CMake 与 scons
---

# B7 构建系统：Makefile→CMake/Ninja→IDF/scons

> 🎯 00-blink 的 Makefile 管两个文件绰绰有余；管两百个文件、二十个可选组件、三种芯片目标呢？构建系统就是为"规模"而生的——但它解决的仍然是 B1 那四步，只是加了**依赖图**和**配置层**。

## 本章精髓

1. Make 的本质是一张依赖图：目标←依赖←规则，mtime 比新旧决定要不要重来——`make -n` 干跑一遍，图就摆在眼前。
2. CMake 不构建，它**生成**构建文件（Ninja/Makefile）：多一层抽象换来跨平台+组件化；ESP-IDF 的 `idf_component_register` 就是在这层抽象上圈地。
3. 配置是独立一维：Kconfig 把"编不编这个组件/开不开这个功能"变成菜单（IDF 的 sdkconfig、RT-Thread 的 menuconfig 同源）——**构建系统管怎么编，Kconfig 管编什么**。

## 学习目标

- 手画 00-blink 的依赖图，并用 `make -n/-d` 验证。
- 写出一个两目录的 CMake 裸机工程骨架（顶层 + 子目录）。
- 对照说明 ESP-IDF（CMake）与 RT-Thread（scons+Kconfig）的组件机制异同。

## 先修

- [B1 四步构建](01-four-steps.md)；用过 [P0](../esp32/00-env.md) 的 idf.py 更佳。

## 先跑起来（10 分钟 quick win）

```bash
make clean && make -n        # 干跑：把将执行的命令全列出，不真做
touch main.c && make -n      # 只动了 main.c，看依赖图如何"局部重建"
```

## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| Make 依赖图 | 目标/依赖/规则三要素；模式规则 %.o:%.c；自动变量 $@$< | 库解析 |
| Makefile 解剖 | 00-blink 的 Makefile 逐行回看：我们其实写了张什么图 | 代码分析 |
| CMake 一层抽象 | add_executable/target_compile_options；工具链文件 toolchain.cmake | 库解析 |
| IDF 组件机制 | idf_component_register 做了什么；REQUIRES/PRIV_REQUIRES 依赖声明 | 库解析 |
| Kconfig 一维 | menuconfig→sdkconfig→宏：配置如何流进代码（联动 [P3](../esp32/03-idf-anatomy.md)） | 配置 |
| scons 对照 | RT-Thread 的 SConscript 思路（联动 [R6](../rtos/rtthread/06-env-menuconfig.md)） | 库解析 |

## 记忆锚点

::: tip 一句话记住
**Make 画图（依赖），CMake 生图（跨平台），Kconfig 管编什么，构建系统管怎么编**——IDF 用 CMake 圈组件，RTT 用 scons 走江湖，底层还是 B1 那四步。
:::

## 实物实验

- 在 00-blink 的 Makefile 里故意删掉 `startup_stm32f407xx.o` 的依赖，touch 启动文件后 make——观察到"没重建"，亲手证明依赖图的价值，然后改回来。

## 常见坑

- **头文件改了不重建**：Makefile 没写头文件依赖——用 `-MMD -MP` 让 gcc 自动生成 .d 依赖文件（进阶 Makefile 标配）。
- **CMake 工具链文件顺序错**：必须在 `project()` 之前 `set(CMAKE_TOOLCHAIN_FILE ...)`，否则用的是主机 gcc。
- **IDF 组件循环依赖**：A REQUIRES B、B REQUIRES A——抽出公共组件 C 是标准解法。
- **把 sdkconfig 提交进仓库**：它是构建产物；该提交的是 `sdkconfig.defaults`。

## 你做到了

- 构建系统从"玄学配置"还原成"依赖图 + 配置层"两件事；
- Makefile/CMake/IDF/scons 四种形态在你眼里是同一件衣服的四个剪裁。

<div class="achievement">
✅ B 篇收官。下一站：<a href="../stm32/index.md">S 篇 STM32 裸机</a>——地基打完，去寄存器的世界里大干一场。
</div>
