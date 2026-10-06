# 站点结构规范

## 目录与文件约定

- 章节页：`docs/<track>/<nn>-<slug>.md`，track ∈ `guide/c/build/stm32/rtos/esp32/lab`。
- 编号前缀（frontmatter title 与 H1 一致）：`C`=c、`B`=build、`S`=stm32、`F`=rtos/freertos、`R`=rtos/rtthread、`对比`=rtos/compare、`P`=esp32、`实验 E`=lab。实例见 `docs/stm32/03-gpio.md`（"S3 GPIO"）。
- 每个 track 有 `index.md` 导览（路线表+精髓一句话），实例 `docs/rtos/index.md`。
- 动画：`docs/public/anim/*.svg`（SMIL）；图片：`docs/public/images/{labs,boards}/`。页面一律用 **Markdown 图片语法** `![一句话描述](/anim/xx.svg)` 引用 public 内文件。原因不是风格：Markdown 图片引用会被 Vite 当作 import 处理——**构建时检查文件存在性并自动加 `/mcu/` base**（本批次构建曾因引用了不存在的 SVG 被这道门拦下）；raw `<img src="...">` 不被 Vite 解析，缺文件只在运行时 404。
- 相对链接必须带 `.md` 后缀且深度正确：rtos 子目录（freertos/rtthread/compare）跨板块链接用 `../../<track>/`（本任务曾集体写错成 `../`，靠死链检查兜住）。
- **工程完整源码必须站内内嵌，不许让读者跳 GitHub 读代码**：成稿章在"记忆锚点"前设 `## 附录：工程完整源码`，用 VitePress 代码导入 `<<< <相对路径>/code/<proj>/<file>`：路径相对**当前 md 文件**定位仓库根下的 code/（`docs/<track>/` 用 `../../`，`docs/rtos/freertos/` 等三层目录用 `../../../`；多一层会解析到仓库外 ENOENT，已踩过两次）。GitHub 链接只作"去仓库 star/提 issue"的附属入口，不作阅读路径。

## config.mts 纪律

- `docs/.vitepress/config.mts` 是唯一导航事实源：nav 七板块、sidebar 按板块分组全量列出。
- **新页面必须同步三处**：sidebar 对应组、本板块 `index.md` 路线表、（如涉及）`docs/lab/index.md` 实验总览。
- `ignoreDeadLinks: false` 是验收门禁，不得为通过构建改回 true；仓库内链接一律用真实地址（`https://github.com/zhuguang-ZFG/mcu/...`），禁止 `https://github.com/` 空占位。

## 主题

- `docs/.vitepress/theme/` = `index.ts`（继承默认主题）+ `custom.css`。
- 已有专用类：`.memory-anchor`（记忆锚点框）、`.achievement`（成就清单）、`.lab-card`、动画 img 卡片化（`img[src*="/anim/"]`）。新样式沿用 BEM 风格的 `mcu-` 前缀或类语义名，勿改 VitePress 变量体系。
