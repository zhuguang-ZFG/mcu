# 执行计划：常驻页头 + 纵向填充

顺序是硬的：先立护栏，再改数据契约，再改渲染，最后才动字号。
每步的验证命令直接可跑；标 ⛔ 的是**不过就不许往下走**的闸。

## 0. 护栏先立（改代码之前）

- [x] 生成既有产物清单：`find video/out -type f | sort | xargs md5sum > research/out-md5-before.txt`
      —— 实际覆盖 **1220 个文件 / 5.3 GB**（比原计划的 `-name '*.mp4' -o -name '发布*.md'` 更严：
      封面 PNG、SRT、`bili-submit.yaml` 一起算）。
- [x] 存一份改前的审计输出：`npm run video:check -- f5-sem-mutex > research/check-before-f5.txt 2>&1`
      —— 不带 `--platform`，两平台一次收全（35 + 12 场）。
- [x] 这条参照可复现，先证明再拿来当闸门：同一命令连跑两遍 `diff` 空。见 `research/baseline-20261017.md` §五。
- [x] 改前基线边界（`research/baseline-f5-sem-mutex.json`）本轮不覆盖。

⛔ 本任务全程禁止对既有 18 个 id 跑 `video:build`（会按新版式重渲已发布的集）。`video:check` 允许，它不写 `video/out/`。

## 1. 数据契约（spec.mjs）

- [x] `sceneSections(scenes, sections)`：返回每场 `{ i, n, title }`（1-based 显示）；`sections` 缺省返回全 `null`；
      首节之前的场次也是 `null`，页头保持旧文案。
- [x] `validateEpisode` 补判据（都算 error）：`at` 命中真实 scene id、下标严格递增、`title` 非空、`at` 不重复，
      外加 `SECTION_TITLE_MAX = 12` 的长度硬校验（1.4 复核已点头）。
- [x] 验证：`npm run video:lint` 全绿（18 个旧集都没有 `sections`，一条错不报）；
      正向/反向用一次性脚本在内存里造 sections（`.temp/sections-selftest.mjs`，不写 `video/episodes/`）：
      缺省⇒全 null、合法⇒零报错、五种写错稿各报一条，6/6 符合预期。
      `at` 重复那一例同时报「重复」与「不递增」两条，是同一处笔误的两个面，不合并——
      合并就要在下标判断里加 `if (!seen)` 的特例，反而更难读。

## 2. 页头渲染（layout.mjs）

- [x] `pageHtml` 收 `sections`，`payload` 每项带 `sec`；新增 `.secchip`（横版只有文字）与 `.secbar`（只竖版）。
      **分叉点在"要不要生成这两个元素"**：没有 `sections` 就不生成，而不是生成了再用 CSS 藏——
      藏起来仍然会进审计的相叠/越界名单，兼容线也就只剩半条。
- [x] `MCU.setup(i)` 内在 `drawTicks(i)` 同一处更新页头（`drawHeader(item.sec)`），**只随 i 变**；
      `setup` 的 `if (i === current) return` 天然保证同一场内页头 DOM 一个字不变。
- [x] 左格去掉 `cover.kicker` 的 `· F5` 尾巴（按 `badge` 匹配剥，不写死集号）——`sections` 缺省时走旧字符串。
- [x] 验证（两层，都不靠目测）：
      ① `npm run video:check -- f5-sem-mutex` 与 `research/check-before-f5.txt` **逐字节相同**（diff 空）。
      ② DOM 层面：老集 `.topbar` outerHTML 仍是 `<div class="topbar"><span class="badge">F5</span><span class="brand2">通往单片机之路 · F5</span></div>`，
      `#secchip`/`#secbar` 都是 `null`；注入夹具后横版 chip 随场次推进到「第 6/6 节」，
      竖版 `secbar` 段数 = n 且 `cur` 跟着节号走，`.ticks` 仍 `display:none`。
- [x] 与设计的一处出入照记：`stage.mjs` 的 `openStage` 多了 `sections` 一个透传参数。
      design §1 说它不动，但不改签名就送不进 `pageHtml`；用模块级全局注入（照 `setAnimSourceReader` 那套）
      会把上一集的分节漏给下一集——`video:build` 是遍历多集的。seek/渲帧语义没动，标定仍不需要重跑。

## 3. 测量夹具（不动仓库里的已发布稿）

- [x] `research/fill-probe.mjs` 加 `--sections <file>` 与 `--out <前缀>`。
      `--out` 不在原计划里，但没有它就危险：默认前缀是 `baseline`，改完 CSS 再跑一次会把
      「改之前长什么样」的唯一凭据（`baseline-f5-sem-mutex.json` + 五张 png）就地覆盖。改后读数一律 `--out after`。
- [x] 夹具 `research/f5-sections.json`：横版 6 节、竖版 5 节，按现有 narration 的语义段落划。
      **形状是按平台分组的** `{bilibili:[…], douyin:[…]}`——竖版 `pick` 是横版 35 场里的 12 场子集，
      同一份边界表在竖版命不中 scene id，整集页头会全空。
      这只是测量夹具，不构成「F5 该补 sections」：F5 已发布，不回炉。
- [x] 12 字上限由实测背书，不是拍的：chip 实测最宽 横版 304px / 竖版 505px，
      `scrollWidth − clientWidth = 0`，35 + 12 场无一溢出。
- [x] 一条判据差点是假的，已纠：「同屏不许两根按场进度」最初按 `querySelectorAll('.ticks, .secbar').length` 判，
      竖版 12 场**全**误报——`.ticks` 一直在 DOM 里，只是 `display:none`。
      改成只数看得见的（computed display ≠ none）后竖版回到 1 根。
      **步骤 7 写进 `cli.mjs` 的那条断言必须用可见性口径**，否则审计会红一整集。

## 4. 纵向填充 · 杠杆 (a)：分布空隙

- [ ] `lay-code` / `lay-hook` 横版：`justify-content:center` → `space-between` + `padding-block`（上≈5u、下≈9u 起量）。
- [ ] 验证：`node research/fill-probe.mjs f5-sem-mutex --platform bilibili --sections research/f5-sections.json`
      → code/hook 的内容上下界进 150…780 量级，`fill` 那一列的**最小值**要写进留档（最差场才算数，平均数会骗人）。
- [ ] `npm run video:check -- f5-sem-mutex` → 七项判据（越界/裁切/压字幕/相叠/顶穿/孤字/字号）仍全 0。
      这条杠杆不该引入任何新失败；一旦引入，说明是在拉伸而不是在分布。

## 5. 纵向填充 · 杠杆 (b)：卡片内部尺度

- [ ] `lay-card`：`.cardpanel` padding 与 `.bullets`/`.title` 字号**一档一量**（改一档跑一次 fill-probe + check）。
- [ ] ⛔ 这条杠杆会把横向放不下的场次交给 `fitAll` 压回，压到 16px 地板就触发 `tooSmall`；
      出现任何 `tooSmall` 命中就退回上一档，别加特例、别动 `MIN_FONT`。
- [ ] 目标带同样以实测为准；`anim`（实测 92%）与 `outro`（23%）不参与，别顺手改它们。

## 6. 竖版

- [ ] 只给竖版 `lay-code`（实测 52%）加杠杆 (a)；`.frame` 的 10u/22u/8u 与 `.caps` 16u **一律不动**。
- [ ] 页头 `.secbar` 放 topbar 下方一条，不底部（抖音客户端的 @作者名/描述/音乐条压在下面）。
- [ ] 验证：`npm run video:check -- f5-sem-mutex --platform douyin` 全 0 +
      fill-probe 出竖版三 kind 的边界表；`.ticks` 在竖版仍 `display:none`，页头杠是唯一进度。

## 7. 审计扩容（cli.mjs）

- [ ] `:226` 压字幕选择器与 `:239` 相叠 marks 各加 `.secchip`、`.secbar`。
- [ ] 新增断言：横版不许同时出现按场的两根进度（`.ticks` 与页头按场杠互斥），DOM 计数判定。
- [ ] 造一次故意的失败：给某一节塞一个 40 字标题，确认审计真的抓到（抓不到等于这条判据是假的）。

## 8. 收尾核对

- [ ] `npm run video:lint` 全绿；`video:check` 对 f5-sem-mutex 两平台全绿。
- [ ] md5 比对：`md5sum -c research/out-md5-before.txt --quiet` → `video/out/` 一个字节都没动。
- [ ] 更新 `research/`：改后边界表 + 每种 kind 一张截图，命名 `after-*` 与 `baseline-*` 成对。
- [ ] PRD 的 AC 按实测分档改写（`anim`/`outro` 豁免、两平台目标带分开、补页头那条），
      这条是 PRD 缺陷回补，走 Phase 1 修订而不是就地放宽。

## 回滚点

- 每步都是独立可 revert 的改动；最稳的两个回滚位是「只加契约、没动 CSS」（步骤 2 之后）
  与「分布完成、字号未动」（步骤 4 之后）。
- 步骤 5（字号放大）是唯一会引入裁切/字号地板失败的地方，出问题就单独退回它，
  不要连步骤 4 一起退。
- 全部改动集中在 `video/src/{spec,layout,cli}.mjs`，一个 commit 可整体 `git revert`；
  `sections` 是纯增量字段，旧稿不含它就走旧渲染，不存在数据迁回。

## 出口条件

版式改造落地后，`10-17-s5-systick-episode` 才允许进 Phase 2 渲帧——S5 是第一个带 `sections` 的集，
也是这次新页头的第一个观众。顺序反过来第 18 集就白做一版。
