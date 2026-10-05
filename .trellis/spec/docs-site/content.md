# 内容编写执行细则

最高法是 [CONTRIBUTING.md](../../../CONTRIBUTING.md)（四件套+风格契约六条），本页是 AI 落地时的操作清单。

## 章节页必含区块（顺序固定）

对照金样例 `docs/c/06-abi-stack.md` 逐段核对：

1. frontmatter `title: <前缀+编号 标题>` 与 H1 一致；
2. `> 🎯` 钩子（≤60 字类比/反直觉问题，禁"本章将介绍"）；
3. 本章精髓（1–3 个"为什么"）；
4. 学习目标（可检验动词：能手算/能逐行讲清/能在板上观测）；
5. 先修（相对链接带 .md）；
6. quick win（10 分钟可见现象）；
7. 小节结构表（含"四件套"列：配置/引脚/库解析/代码分析）；动画小节（如有）放在 quick win 之后、小节表之前：`## 动画：xxx` + 一句话引导 + `![描述](/anim/xxx.svg)`；
8. 记忆锚点（`::: tip 一句话记住`，口诀/对比表/反例）；
9. 实物实验（装备/观测点/预期现象）；
10. 常见坑（≥2 条真实坑，按出现频率排序）；
11. 你做到了 + `<div class="achievement">` 下一站。

成稿增强件（对标金样例 S3/B4/F2）：精髓后加"怎么读这一章"（能记住/能理解/能用三层）；常见坑后加"短自测"（≥3 题，答案 `<details>` 折叠）与"对照表"（本章概念→仓库文件行/章节落点）；有合适视频时加"配套视频"（VideoEmbed，id 须先验证）。

## 事实纪律（强制执行）

- 板卡事实唯一基准：PRD/design 的"已核实板卡事实"（霸天虎 LED=PF6/7/8 共阳、立创 S3 外设清单）。除此之外的寄存器地址/引脚号：写"以 RM0090 §x.x / datasheet / 立创 wiki 原理图为准"，**禁止编造数值**。
- 已核对的数值必须给第二来源：本任务已用 ST 官方 CMSIS 头文件（github.com/STMicroelectronics/cmsis_device_f4）核对 GPIOF=0x40021400、RCC=0x40023800、AHB1ENR=0x30、GPIOFEN=bit5、BSRR=0x18。新增同类事实沿用此法（CMSIS 头文件 / 官方手册 PDF）。

## 动画制作

- SVG+SMIL，viewBox 宽 720，`<animate>` 用 `calcMode="discrete"` 做阶段切换（样例：`docs/public/anim/stack-frame.svg` 的四阶段 12s 循环结构，照抄其 keyTimes/values 模式）；
- 配色固定：底 #f6f8fa、主 #3451b2、强调 #3eaf7c、警示 #d97706；字号 ≥12px；
- 每个动画必须被至少一个章节页引用，并在 PR 描述写"表达结论一句话"。

## 提交前自检

```bash
npm run docs:build                                    # 零错误（含死链）
grep -rn "TODO\|待补充\|placeholder" docs/ --include="*.md"   # 无命中（除 template.md 的元说明）
```
