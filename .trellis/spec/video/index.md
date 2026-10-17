# video 规范索引

`video/` 这条线：`episodes/*.json` → `src/{spec,layout,stage,cli}.mjs` → `out/<id>/<platform>/` → `publish/` 四平台投放（B站/抖音/知乎/小红书）。
投放侧的台账与不可逆点在 `.agents/skills/video-release/SKILL.md`，本目录只管"怎么改才不弄坏已发布的那些集"。

| 文件 | 内容 |
|---|---|
| [layout-contract.md](layout-contract.md) | 常驻页头 `sections` 契约、按场进度唯一性、纵向填充的两条杠杆与"填充比当不了闸"的实测依据、`video:check` 回归口径 |

## 快速命令

```bash
npm run video:lint                                  # 全量 episode.json 契约校验
npm run video:check -- <id> --platform <p>          # 舞台 + 排版审计（不渲帧、不写 out/）
npm run video:build -- <id>                         # 会渲帧写 out/：只对未发布集用
node .temp/zh-cover.mjs <id…>                       # 补 zhihu-cover.png（1920×1080）
node .temp/douyin-cover43.mjs <id> 1440 1080        # 补 douyin-cover-1440x1080.png（抖音投稿脚本的硬输入）
```

`video:build` 只产 `<platform>-cover.png` 那两张；已投的 20 集每一集都另有 `zhihu-cover.png` 与
`douyin-cover-1440x1080.png`，生成方在 `.temp/` 而不是产线里。两张都走同一个 `buildCover`，
所以 `fitCover` 的「装不下就 throw」护栏照样生效——不是拿 `bilibili-cover.png` 去裁。
新集渲完就把这两张补上再谈投稿，否则 `douyin-step.mjs:26` / `zh-step.mjs:27` 会在上传那一步才报文件不存在。

## 三处顺序闸（都是跑出来的，不是推的）

1. **`lint → build → check`，不能反。** 新集在没有 `video/out/<id>/<平台>/timeline.json` 时跑 `video:check`，
   `cli.mjs:597` 打 `⏭️ … 还没有时间轴，跳过` 并 **exit 0**。那叫假绿：看到 `跳过` 就是没跑。
   全量 check 的期望值是「`🔍 排版审计通过` 的行数 = 平台数（19 集里 c3b 只有竖版 → 37）」且 `跳过` 计数 **0**。
2. **`series.json` 登记排在 `video:build` 之后。** `publish/douyin-release.mjs:69` 对片单里每个条目硬取
   `video/out/<id>/douyin/timeline.json`，缺了就 throw「这条还没渲过，别造文案」——先登记会让那份清单生成器整支红。
   反过来 `video:build` 全程不读 `series.json`（`src/` 里只有 `package.mjs:377` 那句文案提到它），
   `bili-ledger.mjs` 也自带「没有横版 master 就归 noMaster、不算漏投」的分支。渲完再登记还有一好处：
   `masters` 直接写实测时长，不落脚本占位符。
3. **时长不许贴着 `targetSec` 上沿写。** `lint` 用 `SEC_PER_CHAR` 估（bilibili 0.1955 s/字、
   douyin 0.1946 s/字 + 1.091 s/场），`build` 拿**实际秒数**过硬门；两者之间有一族实测离散度：
   17 集 × 双平台 `act/est` 落在 **bilibili 0.951–1.049 / douyin 0.947–1.060**
   （复算：`node .temp/s5-dur-calib.mjs`，读 `video/out/*/*/timeline.json` 与实际 duration 对比）。
   所以估出来 693s 而目标是 720s 不算过——最坏 ×1.049 = 727s 已经破门。
   **判据：`est × 该平台上沿比值 ≤ targetSec[1]`**，超了就裁旁白，不放宽阈值、不砍场。
   S5 就是这么落地的：横版 3545 字（est 693.0s）裁 23 处到 3382 字、竖版 312 字裁 3 处到 279 字，
   成片实测 629.167s / 67.933s，`act/est` = 0.951 / 1.008。

## 金样例

- 页头分节夹具：`.trellis/tasks/archive/2026-10/10-16-video-layout-header-fill/research/f5-sections.json`（测量夹具，故意不进 `episodes/`）
- 版式改版的完整证据链：`.trellis/tasks/archive/2026-10/10-16-video-layout-header-fill/research/baseline-20261017.md`
- **`sections` 的第一个真集**：`video/episodes/s5-systick/episode.json`（横版 6 节 / 竖版另配 5 节，两平台各一份边界表）
- 屏上数字对账的写法：`.temp/s5-numbers.mjs`（把两平台含 `pick`/`set`/`narration` 覆写的所有上屏字段展平，
  逐 token 回本机 probe 留档找；未命中的必须逐个定性成"行号 / 原文写法 / 同值短写法"并带明示）

