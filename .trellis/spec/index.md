# Trellis 规范索引：通往单片机之路

本仓库是 **VitePress 教学站点 + 嵌入式示例代码**，不是 Web 应用。规范按三层组织：

| 层 | 目录 | 什么时候读 |
|---|---|---|
| 站点与内容 | [docs-site/](docs-site/index.md) | 改 docs/ 下任何页面、config、动画、图片前 |
| STM32 固件 | [firmware-stm32/](firmware-stm32/index.md) | 改 code/stm32/ 下寄存器级工程前 |
| ESP32 固件 | [firmware-esp32/](firmware-esp32/index.md) | 改 code/esp32/ 下 IDF 工程前 |

## 全局纪律

- 内容质量的最高法是仓库根目录 [CONTRIBUTING.md](../../CONTRIBUTING.md)（四件套、风格契约、动画/图片规范）；spec 只补充"AI 在此仓库怎么干活"。
- 验收构建：`npm run docs:build`（死链检查开启，必须零错误）。
- 禁占位：`grep -rn "TODO\|待补充\|placeholder" docs/` 必须无命中。
- 事实纪律：寄存器地址/引脚号必须有出处（RM0090 章节号/datasheet/官方原理图/板厂 wiki），写不进正文的标注"以 XX 为准"，禁止编造。
