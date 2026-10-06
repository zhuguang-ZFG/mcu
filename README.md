# 通往单片机之路

> 把一颗芯片讲透：寄存器级 STM32F407 × ESP32-S3 双路线 · C 语言精髓 · RTOS 双精讲 · 全程实物实验

受[通往AGI之路](https://waytoagi.feishu.cn/)启发——像它讲 AI 一样讲单片机：开源、体系化、面向初学者，但**不浅**。我们的信条是"挖掘精髓"：每一个知识点都要追到寄存器、追到源码、追到示波器上的波形。

## 为什么不一样

| 常见教程 | 本项目 |
|---|---|
| 调库点灯 | 手写启动文件、链接脚本，从 0x08000004 讲到你点亮它 |
| "本章将介绍……" | 每章一个钩子开场，先见现象，再挖原理 |
| 复制粘贴能跑就行 | 四件套：功能配置图解 + 引脚设置 + 库源码逐行解析 + 代码逐行分析 |
| RTOS 讲讲 API | FreeRTOS 内核源码级 + RT-Thread 精讲，上下文切换画成动画 |
| 纸上谈兵 | 每个实验都能在真实板卡上复现，配 SVG 接线图与实测要点 |

## 基准板卡（作者实持，全部实验可复现）

- **野火 STM32F407 霸天虎**（F407ZGT6）——STM32 寄存器主线；RGB 红灯 PF6/绿 PF7/蓝 PF8
- **立创·实战派 ESP32-S3**（小智板，N16R8：16MB Flash + 8MB PSRAM）——ESP-IDF 主线

## 路线图

```mermaid
flowchart LR
    A[C 语言精髓] --> B[构建与运行全过程]
    B --> C[STM32 寄存器裸机]
    B --> D[ESP32-S3 + ESP-IDF]
    C --> E[FreeRTOS 精讲]
    C --> F[RT-Thread 精讲]
    D --> E
    E --> G[双 OS 对照与选型]
    F --> G
    G --> H[综合项目]
    A -. 贯穿 .-> L[实物实验中心]
    C -. 贯穿 .-> L
    D -. 贯穿 .-> L
```

## 目录

```
docs/            VitePress 站点（全部教程内容）
├── guide/       导读：怎么学 / 实物装备 / 手册地图
├── c/           C 语言精髓（8 章）
├── build/       构建与运行全过程（8 章）
├── stm32/       STM32F407 寄存器主线（17 章）
├── rtos/        FreeRTOS + RT-Thread 双精讲 + 对照（20 章）
├── esp32/       ESP32-S3 + ESP-IDF（13 章）
└── lab/         实物实验中心（模板 + 8 个实验）
code/            与章节同构的示例代码（寄存器版，全部逐行注释）
```

## 本地预览

```bash
npm install
npm run docs:dev      # http://localhost:5173
npm run docs:build    # 产出 docs/.vitepress/dist
```

## 参与贡献

章节成稿、动画制作、实物实验、勘误都欢迎——先读 [CONTRIBUTING.md](CONTRIBUTING.md)（内容深度标准、风格契约、动画与图片规范都在里面）。

## 状态

🚧 章节成稿 19 篇（S×7 / F×7 / P×4 / **G×1**）+ 动画 28 张 + 实验 E01–E03；每条路线都有能上板的配套工程。GD32 双系路线（G 篇 ARM GD32F4xx / V 篇 RISC-V GD32VF103）建设中，G1 RCU 时钟树已成稿。

## License

[Apache-2.0](LICENSE)
