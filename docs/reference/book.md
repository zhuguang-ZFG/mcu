---
title: 整书离线版
description: 88 章成书：单文件 HTML（动画即播）与 A4 PDF（三级书签），随站点发布，与在线内容同源同契约。
---

# 整书离线版：把 88 章装订成一本书

> 🎯 网页适合跳读，书适合通读。这一页是整书的入口：同一份 88 章正文，装订成 10 个分部 + 6 份附录的单文件 HTML 与 A4 PDF——断网可读、打印不丢内容，与在线站点同一份数据源。

## 两个产物

| 产物 | 适合 | 特性 |
|---|---|---|
| [📖 HTML 版](https://zhuguang-zfg.github.io/mcu/book/mcu-deep-book.html) | 屏幕通读 | 单文件约 6 MB，所有图片内嵌，**断网可读**；109 张机制动画打开即播；每章开头有「本章罗盘」，章末自测答案集中在附录 C |
| [📄 PDF 版](https://zhuguang-zfg.github.io/mcu/book/mcu-deep-book.pdf) | 打印 / 平板批注 | A4、约 650 页（随字体度量浮动），书签树为**部 → 章 → 节**三级；打印前自动展开全部折叠块，参考答案不丢失 |

两个文件都由 CI 在每次 push 时从仓库源文档重新构建并随站点发布——书没有"过期副本"，永远是 main 的快照。

## 这本书和站点是什么关系

- **同一份正文**：88 章 markdown 一字不改，站点读它、书也读它；站点方言（提示容器、测验、实验信息卡、视频与交互计算器）在书里被替换为离线等价物。
- **同一份罗盘**：每章页顶的「本章罗盘」（问题 / 交付 / 边界 / 依据锚点）与整书共用 [mcu-book/manifest.json](https://github.com/zhuguang-ZFG/mcu/blob/main/mcu-book/manifest.json)——站点展示与成书内容天然同源。
- **六份附录**：A 工程深读（从 IDLE 中断到帧协议的五个契约）· B 47 个配套工程索引 · C 自测参考答案 · D 术语速查 · E 来源注册表（60 项冻结来源）· F 常见问题。
- **同一套纪律**：凡是没接仪器量过的现象，书里与站点一样标「待上板实测」；构建契约保证章节、罗盘、测验、工程索引四向对账，缺一个就出版失败。

## 本地构建

```bash
npm run book:check      # 临时目录验证整书契约
npm run book:pdf        # 产出 mcu-book/dist/ 下的 HTML 与 PDF（需本机 Chrome/Edge）
```

构建器、manifest 与六份附录的维护说明见 [mcu-book/README](https://github.com/zhuguang-ZFG/mcu/blob/main/mcu-book/README.md)。

## 版本口径

当前 **v1.0.0**（manifest `version`，2026-10-23 冻结）。书的版本跟着 manifest 走：新增章节需同步登记分部与罗盘，漏登会被构建契约拦下。

## 你做到了

- 知道书在哪、为什么它不会过期（CI 随 push 重出）；
- 通读时有了页码与书签，引用章节可以落到"第几部第几章"而不是一个 URL；
- 想改书时知道唯一入口：改 `docs/` 正文或 `mcu-book/`，两端一起变。
