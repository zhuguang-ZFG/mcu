# video 规范索引

`video/` 这条线：`episodes/*.json` → `src/{spec,layout,stage,cli}.mjs` → `out/<id>/<platform>/` → `publish/` 三平台投放。
投放侧的台账与不可逆点在 `.agents/skills/video-release/SKILL.md`，本目录只管"怎么改才不弄坏已发布的 18 条"。

| 文件 | 内容 |
|---|---|
| [layout-contract.md](layout-contract.md) | 常驻页头 `sections` 契约、按场进度唯一性、纵向填充的两条杠杆与"填充比当不了闸"的实测依据、`video:check` 回归口径 |

## 快速命令

```bash
npm run video:lint                                  # 全量 episode.json 契约校验
npm run video:check -- <id> --platform <p>          # 舞台 + 排版审计（不渲帧、不写 out/）
npm run video:build -- <id>                         # 会渲帧写 out/：只对未发布集用
```

## 金样例

- 页头分节夹具：`.trellis/tasks/archive/2026-10/10-16-video-layout-header-fill/research/f5-sections.json`（测量夹具，故意不进 `episodes/`）
- 版式改版的完整证据链：`.trellis/tasks/archive/2026-10/10-16-video-layout-header-fill/research/baseline-20261017.md`
