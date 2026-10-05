# docs-site 规范索引

VitePress 站点的一切（页面、侧边栏、主题、动画、图片）。

| 文件 | 内容 |
|---|---|
| [structure.md](structure.md) | 目录约定、config/sidebar 纪律、frontmatter 与编号体系 |
| [content.md](content.md) | 章节页模板执行细则、风格落地检查、动画与图片操作 |

## 快速命令

```bash
npm run docs:dev      # 本地预览
npm run docs:build    # 验收门禁：死链检查开启，必须零错误
```

## 金样例（模仿对象）

- 骨架章：`docs/c/06-abi-stack.md`
- 成稿章：`docs/stm32/00-env.md`、`docs/esp32/00-env.md`
- 实验：`docs/lab/e01-blink.md`（模板 `docs/lab/template.md`）
