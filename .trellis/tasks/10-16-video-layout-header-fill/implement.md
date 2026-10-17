# 执行计划：常驻页头 + 纵向填充

顺序是硬的：先立护栏，再改数据契约，再改渲染，最后才动字号。
每步的验证命令直接可跑；标 ⛔ 的是**不过就不许往下走**的闸。

## 0. 护栏先立（改代码之前）

- [ ] 生成既有产物清单：`find video/out -name '*.mp4' -o -name '发布*.md' | sort | xargs md5sum > .trellis/tasks/10-16-video-layout-header-fill/research/out-md5-before.txt`
- [ ] 存一份改前的审计输出：`npm run video:check -- f5-sem-mutex --platform bilibili > research/check-before-f5.txt 2>&1`
- [ ] 改前基线边界已经有了（`research/baseline-f5-sem-mutex.json`），本轮不许覆盖它——它是「改之前长什么样」的唯一凭据。

⛔ 本任务全程禁止对既有 18 个 id 跑 `video:build`（会按新版式重渲已发布的集）。`video:check` 允许，它不写 `video/out/`。

## 1. 数据契约（spec.mjs）

- [ ] `sceneSections(scenes, sections)`：返回每场 `{ i, n, title }`；`sections` 缺省返回全 `null`。
- [ ] `validateEpisode` 补四条 error：`at` 命中真实 scene id、下标严格递增、`title` 非空、`at` 不重复。
- [ ] 验证：`npm run video:lint`（无参数=遍历 `video/episodes/`，18 个旧集都没有 `sections`，必须一条错都不报）
      + `npm run video:lint -- s14-pwr`（14 张卡片、标题最长的那一集，拿来当误报试纸）。

## 2. 页头渲染（layout.mjs）

- [ ] `pageHtml` 收 `sections`，`payload` 每项带 `sec`；新增 `.secchip`（横版只有文字）与 `.secbar`（只竖版）。
- [ ] `MCU.setup(i)` 内在 `drawTicks(i)` 同一处更新页头，**只随 i 变**。
- [ ] 左格去掉 `cover.kicker` 的 `· F5` 尾巴——但 `sections` 缺省时页头文本必须与改前逐字相同（旧集回归）。
- [ ] 验证：`npm run video:check -- f5-sem-mutex`（旧稿无 `sections`）→ 审计输出与 `check-before-f5.txt` 逐字相同。
      这条是兼容线的实测证明，不是「看起来没变」。

## 3. 测量夹具（不动仓库里的已发布稿）

- [ ] 给 `research/fill-probe.mjs` 加 `--sections <file>`：从 research 下的 JSON 注入分节，
      在内存里造 `sections`，**不写 `video/episodes/`**（`video:lint` 无参数会遍历整个目录，
      放一个 `_layout-lab` 假集进去就会被当成第 19 集校验，是污染）。
- [ ] 造一份 F5 的 6 节分节表当夹具（按现有 narration 的语义段落划），存 `research/f5-sections.json`。

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
