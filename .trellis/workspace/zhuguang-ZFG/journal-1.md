# Journal - zhuguang-ZFG (Part 1)

> AI development session journal
> Started: 2026-10-06

---

## 2026-10-06 站点奠基（任务 10-06-01 + 00）

**决策**：VitePress 站点；STM32 寄存器主线（霸天虎 F407ZGT6）；ESP-IDF v5.5（立创实战派 S3）；FreeRTOS+RT-Thread 双精讲；四件套+风格契约+动画实物。

**产出**：84 个 md 页面（七板块+金样例）；双路线第 0 章成稿；code/stm32/00-blink 四文件全套；code/esp32/00-hello；动画×3（SVG+SMIL）；实验模板+E01+接线 SVG；README/CONTRIBUTING；.trellis/spec 按真实结构重写。

**验证**：docs:build 零错误（ignoreDeadLinks=false，含 FPU 修复后复验）；占位 grep 干净；浏览器实测首页+C6+动画加载；寄存器事实经 ST 官方 CMSIS 头文件核对全对；task_verify=unverified（无配置检查）。

**审查修复**：启动文件漏使能 FPU（CPACR）——硬浮点编译下第一条 FPU 指令即 UsageFault(NOCP)，已补并使 B4/spec/README 三处同步为"启动四工序"。评审另一项"栈帧顺序"质疑经核对为误报（xPSR 居最高地址、sp 指向 R0，SVG 画法正确）。

**教训**：①子代理 15 分钟硬时限，25 页/人+读大文档=全部超杀零产出——切片≤5 页且上下文内联；②rtos 子目录跨板块链接需 `../../`；③模板示例图片路径须放代码块防 Vite import 解析；④连续 hashline 编辑必须先回读再落刀（本轮三次行号猜测失误）。



## Session 1: 项目质量修复：本地验收完成

**Date**: 2026-10-06
**Task**: 项目质量修复：本地验收完成
**Branch**: `main`

### Summary

完成场景构建隔离、三个实验工程、S3 目标保护、工程清单与严格元数据、实验状态、CI 门禁、高亮与搜索优化。25 单元 + 3 浏览器测试通过，19 工程构建/取证通过。保留原 B3 工作；集成提交、远端 CI、上板实测待执行，见当前任务 research/validation.md。

### Main Changes

- 新增 E05/E07/E08 工程；修复 GD32 Thumb 复位向量、GPIO 占用脚输出与 FreeRTOS 场景产物复用。
- CI 复用完整质量检查，实验状态与源码/实测证据分开；详见任务验收记录。

### Git Commits

未提交：这是实施与本地验收会话；保留 B3 并行工作，等待集成。

### Testing

- npm run quality、firmware:check、test:browser 通过；性能测量完成。远端 CI 与硬件实测未执行。

### Status

本地实现和验收完成，任务仍为 **in_progress**，未将集成/硬件验收标为完成。

### Next Steps

- 集成 B3 原工作及本任务改动，运行远端 CI；有目标板与仪器后补充实测。


## Session 2: 提交质量修复并通过远端 CI

**Date**: 2026-10-07
**Task**: 提交质量修复并通过远端 CI
**Branch**: `main`

### Summary

已提交推送 main；远端文档、浏览器、ARM/host、六项 ESP32-S3 构建及 Pages 全部成功。完成当前任务归档，硬件实测仍独立待执行。

### Main Changes

- B3 原有章节与链接器取证作为独立提交 50d6e5e 集成，质量修复提交 286d692；已推送 main。
- GitHub Actions run 37492733587 的 9 个 jobs 全部成功，包括 ARM/host、文档与浏览器回归、六个 ESP32-S3 工程和 Pages 部署。
- 任务已归档至 .trellis/tasks/archive/2026-10/10-06-project-quality-reproducibility，保存远端状态 JSON 与验收记录。
- 硬件仍待实际测量，不以 CI 代替上板证据；旧开发依赖告警按原方案记录为后续事项。


### Git Commits

| Hash | Message |
|------|---------|
| `50d6e5e` | (see git log) |
| `286d692` | (see git log) |

### Testing

- GitHub Actions run 37492733587 全部 9 个 jobs 为 success（25 单元测试、3 浏览器回归、全工程构建/取证、Pages）；记录在归档任务 research/ci-first-success.json。

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 3: 抖音投放收口：s2-rcc 封面去母题过审、导流评论落库

**Date**: 2026-10-16
**Task**: 抖音投放收口：s2-rcc 封面去母题过审、导流评论落库
**Branch**: `main`

### Summary

第 9 集 s2-rcc 完成抖音投稿，16 集在抖音全部投齐（作品 41→42，平台侧回读 2026年10月16日 11:44 已发布）。抖音判「请勿使用截屏当封面」的单一变量是横封面上的 wave 母题，去母题后预发布快速检测转「封面效果检测通过」，改法落进 platforms.douyin.cover 并重生成做像素核对。导流评论已发并逐字回读（cid=7697135842757772041，128 字与发布文案一致），置顶经实测仍需 App 长按。投放驱动的固定等待被 6.8~10.2 秒的上行全部打穿，改为复用标签页加轮询。

### Main Changes

- **封面判定的单一变量找到了**：抖音那句「请勿使用截屏当封面」和 s2 横封面上的 `wave` 母题有关——f3/s4 的横封面没有母题就过。去掉母题后，预发布快速检测当场翻成「封面效果检测通过」。修法走 `platforms.douyin.cover` 整块替换（`package.mjs:278` 的既有口径），B站/知乎仍读 base `cover`，所以两边封面不受影响；改完重生成并做像素核对，与平台实测过的图一致（横 0%、竖 0.831% 仅抗锯齿，对照 29.166%）。
- **`aweme_id` 取不到不是脚本的错**：内容管理页的 DOM 里压根不放 id（已发布也一样，`dy-id-one.mjs` 因此空手）。要抓它自己的列表接口 `creator/janus/douyin/creator/pc/work_list`，按标题定位取号，并用 `duration` 对一遍（65640 ↔ 65.600s）。
- **评论「没发出去」是链路假象**：回车提交是有效的，但这条上行上请求过了约 2.5 分钟才落库。中间窗口里同时能看到「编辑框还有字」和「暂无评论」，按 DOM 判失败就会重发成两条。最终平台侧只有一条：`cid=7697135842757772041`，128 字与 `发布-douyin.md`「## ②」逐字一致，作者带 作者 标。
- **置顶仍然只有 App 能做**：2026-10-16 实测，自己那条评论的 `⋯` 菜单里只有「删除评论」，没有置顶项。web 端做不到不是脚本没写对。
- **慢链路打穿了所有固定等待**：daemon 的 30 秒 `goto` 直接把常驻浏览器带崩（进程一退窗口就关，登录态白搭）；评论脚本固定等 12 秒必然赶不上评论区水合。统一改成「复用已开着的标签页 + 轮询到元素真出现」，导航预算放到 240 秒。
- 顺带把 `.temp` 投放驱动补了几道硬保护：发前清空编辑框并确认清空、这条文案已在列表里就停（防重发刷屏）、提交只认评论行内最右侧图标且排除 danmaku 容器。其中**图标提交那条路径未经实战**——重复保护在它真发之前就停了。


### Git Commits

| Hash | Message |
|------|---------|
| `395accc` | (see git log) |
| `327d136` | (see git log) |

### Testing

- Validation was not recorded for this session.

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 4: F5 片单补录 + 三平台投放（抖音/B站成，知乎撞频控）

**Date**: 2026-10-16
**Task**: F5 片单补录 + 三平台投放（抖音/B站成，知乎撞频控）
**Branch**: `main`

### Summary

F5《信号量和互斥量》收进片单（no:17、next 清空），断行修复与 B站简介压字（2177→1982，publish.bilibili.intro 1310→1115）都已提交推送。投放：抖音在线（aweme_id 7697231677763931428，66977ms 与成片一致，导流评论 cid=7697253575721992960 逐字校验，置顶仍需 App 手动）；B站 BV1JsJt6bEFH（9 项回读全过）。知乎三次被拒，响应体 code=10000「近期发布频率过高，请24小时后重试~」——账号 10-15 15:43 批量 8 条 + 当晚并发投 STM32 系列，是账号级滚动频控，草稿完整无需重传，窗口过后 node .temp/f5-zh-publish.mjs 续传。平台实测事实落 .temp/zhihu-plan.md：成功只认「发布成功」弹窗、失败只认 /api/v4/content/publish 响应体、内容管理列表返回的是 pin 不能当回读、CDP 里 browser.close() 会杀常驻浏览器。顺手补了两处会复发的坑：f5-zh-publish.mjs 原先成功也不写 published.txt 留痕（下轮会误判成没投）且不删闸门，现在留痕+删闸门+有留痕即拒跑。遗留观察：抖音合集把 F5 排成第16集，与片单 no:17 不同源——合集序号由平台按入集合顺序自己排，B站分P才用我们的编号。

### Main Changes

- Detailed change bullets were not supplied; see the summary above.

### Git Commits

| Hash | Message |
|------|---------|
| `49b9250` | (see git log) |
| `f9d00a2` | (see git log) |
| `8c14cfd` | (see git log) |

### Testing

- Validation was not recorded for this session.

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 5: F5 投放收尾 + 与 STM32 项目逐帧对比，开出两条后续任务

**Date**: 2026-10-16
**Task**: F5 投放收尾 + 与 STM32 项目逐帧对比，开出两条后续任务
**Branch**: `main`

### Summary

抖音腿补齐：导流评论 cid=7697253575721992960 逐字校验通过并写进 .temp/douyin-submitted.txt（置顶仍须 App 长按）。知乎三次被拒后确认是账号级滚动频控（code=10000），草稿完整无需重传；顺手把 f5-zh-publish.mjs 补成「成功才落 published.txt 留痕 + 用掉即删闸门 + 有留痕就拒跑」，这三处缺的语义正是今晚「弹窗没抓到却无从证伪」的同一种瞎。知乎这条线跑了 16 条一直没有 runbook，补 .temp/zhihu-plan.md（与 douyin-plan/wx-plan/yt-plan 同规格）：成功只认「发布成功」弹窗、失败只认 /api/v4/content/publish 响应体、creations/v2/zvideo 返回的是 pin 不能当回读、续传前必须逐字比对草稿标题前 60 字（今天横幅上挂的是别的会话的稿）、CDP 里 browser.close() 会杀常驻 9223 浏览器。与 D:/Users/STM32/final-videos 逐帧对比（同物种：1080p30/配音+SRT/11–14 分钟）：差距两处——常驻页头不答「第几章哪一节」、内容块纵向只用了 y≈300–700 中间一条；不抄的两处也记了数（他们单条 1 GB/10 Mbps vs 我们 539 kbps；选择题卡片+吉祥物会稀释「屏上每个数都能 probe.sh 复现」这条卖点）。据此开两条 Trellis 任务：10-16-e04-board-measurement（填 docs/lab/e04-priority-inversion.md:101 那张至今全空的四行表，硬约束=模型值 6000/2500 永不作为实测填入）、10-16-video-layout-header-fill（版式两处改造，只对未发布新集生效，依赖下一集立项，因 series.json 的 next/backlog 现在都是空）。

### Main Changes

- Detailed change bullets were not supplied; see the summary above.

### Git Commits

| Hash | Message |
|------|---------|
| `797a228` | (see git log) |

### Testing

- Validation was not recorded for this session.

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 6: B站 17 条简介脱 markdown 残留 + 合集门槛取证

**Date**: 2026-10-16
**Task**: B站 17 条简介脱 markdown 残留 + 合集门槛取证
**Branch**: `main`

### Summary

实测 B站简介区按纯文本渲染（pre/code 数 0），17 条线上稿件的 ``` 围栏/行内反引号/** 全部原样露出；逐字核验只删标记后全量回传，公开页复读 17/17 干净，生成端加 plain() 断源。合集建集被 code=20082 挡，真因是 season=false（权益中心 Lv2 门槛），判据与就绪三步记进新任务 PRD。

### Main Changes

**做了什么**

用户指令两条：先建 B站合集挂 17 条，再补简介去反引号。第二条做完，第一条撞平台门槛，证据已入账（`.trellis/tasks/10-16-bili-season-after-unlock/`，commit `0cc07d6`）。

**关键发现**

1. B站简介区是 `white-space: pre-line` 的纯文本——实测视频页 `pre`/`code` 元素数为 0，`span.desc-info-text` 里 ``` 围栏、`行内代码`、`**粗体**` 全部原样露给观众。发布稿本身是 markdown，围栏是给 md 用的，问题只在跨到平台这一发没脱标记。
2. 合集那条 `code=20082 您创建的合集个数太多了` 是伪装文案：`seasons` 返回 `total=0`，账号一条都没有。真门槛在投稿页那行「开通合集功能需满足权益中心等级达 Lv2」，`white` 接口 `season=false`/`new_season=false` 读死，两个合集管理路由都打回 `/platform/home`。
3. `x/member/web/exp` 的 `current_level`（本账号 Lv4）是用户经验等级，不是权益中心等级，`.temp/bili-level.mjs` 里那句「能否建合集=level>=2」推断是错的，已在 PRD 写明别再拿它当判据。

**改了哪些**

- `.temp/bili-desc-fix.mjs`（新）：dry 逐条算脱标记差异并留改前原文 `.temp/desc-live/`，post 一发一条走全量回传，发完立刻复读核对。`vupre` 连打会 `-702` 限频，加了 1.5s 间隔 + 退避重打。
- `.temp/bili-cover-edit.mjs`：`k=v` 的 v 支持 `@文件` 写法——简介上千字带换行，走命令行必然被 shell 掰断。
- `.temp/bili-submit.mjs`：desc 组装加 `plain()`，新集投稿前就脱标记，2000 字上限按脱完的长度拦。
- `.temp/bili-season-page.mjs`、`.temp/bili-upower.mjs`、`.temp/bili-right-center.mjs`（新，只读探针，只 `page.close()`）。

**验证**

- 脱标记前后逐字核验：去掉 ` * 空白` 后 17/17 与原文完全一致、顺序不变，只删了 2 行围栏 + 成对反引号 + 成对星号（F5 另有 9 对行内反引号、2 对粗体）。
- 17 条 `edit` 全 `code=0`，复读编辑框与公开 `view` 接口：简介长度逐条等于目标、残留归零、`state=0`。作者侧 `state=-6` 只是改动复核标记，公开页不受影响。
- 观众侧页面复扫：`命中反引号节点数 0`。
- 生成端 `--dry` 的 17 条简介长度与线上逐条相等，两条通道口径一致。

**待办**

- 知乎 F5 仍被账号级 24h 频控挡着，草稿完整，闸门文件 `.temp/zh-run/I_HAVE_USER_OK=f5-sem-mutex` 留在原地，窗口过了跑 `node .temp/f5-zh-publish.mjs`。
- 抖音 F5 那条评论需用户在 App 里长按置顶（web 端无置顶入口，`stick_position=0` 已留痕）。


### Git Commits

| Hash | Message |
|------|---------|
| `0cc07d6` | (see git log) |

### Testing

- Validation was not recorded for this session.

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 7: 视频版式改版落地：页头小节 chip + 纵向分布，填充率判据被实测否掉

**Date**: 2026-10-17
**Task**: 视频版式改版落地：页头小节 chip + 纵向分布，填充率判据被实测否掉
**Branch**: `main`

### Summary

常驻页头补 sections 契约与「第 i/n 节 · title」chip（竖版另给一根 .secbar），code/hook 改成只加 gap、横版 card 让面板长满；694 场逐场实测证明纵向填充比既当不了审计闸也不能当优化目标——space-between 把读数刷到 0.74/0.90 却留 250–470px 空洞被截图否掉，竖版 padding 把 8 场压穿 16px 地板是真回退已退回。审计扩到第八项「同屏两根按场进度」，18 集 × 双平台 exit 0、无 sections 的旧集页头逐字节不变、video/out/ md5 未动。S5 第 18 集出口条件解除。

### Main Changes

**做了什么**

会话前半先把第 18 集选题定档 S5 SysTick、backlog 补四条候选（`1fa7d1d`）、给 S5 立项 PRD 与实跑留档（`69fd32a`）、把版式任务补到可 start（`78e67f6`）；1.4 复核通过后从步骤 0 一路跑到步骤 8：常驻页头加「当前小节」，两类版式的纵向分布改掉，排版审计扩到第八项。落地分成两个 commit——`83a292a`（sections 契约 + 页头渲染）与 `ce08dc7`（纵向分布 + 审计扩容）。

**关键发现**

1. 纵向填充比既当不了审计闸，也不能当优化目标。18 集 × 双平台 694 场逐场实测：任何 ≤0.70 的全局阈值都判红 246–377 个已发布场次。而 `justify-content:space-between` 能把 code/hook 读数从 0.55 刷到 0.74（竖版 0.90），截图却是标题贴页头、代码贴下沿、中间空 250–470px。CSS 分布只能决定「洞摆在哪」，code/hook 的填充由每场内容量决定。
2. `padding-block` 是实伤不是观感：竖版加 3u/6u 把长代码场挤给 fitAll，19.1px 压到 13.3px，f2/p4/s16 三集 8 场撞审计的 16px 地板（`video:check` exit 1）。控制变量用 `git checkout HEAD -- video/src/layout.mjs` 复跑，证明改前是绿的——这是真回退，不是既有欠账。
3. 唯一能被 CSS 钉死的 kind 是 card：横版让面板长满（`justify-content:stretch` + `flex:1 1 auto`）125 场全部到 0.82；竖版原样不动，它改版前实测就有 0.85，「长满」只会把三行字的短卡吹成巨框。
4. 进度杠判据必须数**看得见的**那几根：竖版 `.ticks` 一直挂在 DOM 里只是 `display:none`，按节点数判 12 场全部误报。
5. 页头标题超长由两层各抓一半：竖版靠几何（42 字塞进 `.secchip` → 12 场 `越出画布`），横版靠契约（1920 装得下，`loadEpisode` 的 `SECTION_TITLE_MAX=12` 先拦）。原 design 写的「审计抓到」是只想到了一层。

**改了哪些**

- `video/src/spec.mjs`：`sceneSections()` 纯函数 + `SECTION_TITLE_MAX=12` + `validateSections()` 接进 `validateEpisode`（`at` 命中/严格递增/`title` 非空/`at` 不重复，四条都算 error）。
- `video/src/layout.mjs`：页头左格收成 badge + 系列名（去掉重复的 `· F5` 尾巴），右格新增 `.secchip`「第 i/n 节 · title」，竖版另给一根 `.secbar`（它 `.ticks` 本就关掉，这是唯一按节进度载体）；`.lay-code/.lay-hook` 只加 gap（横 4u / 竖 2.4u，字号地板是竖版只抬到 2.4u 的理由）；横版 `.lay-card` 面板长满、竖版留旧摆法。页头 DOM 唯一写入点是 `MCU.setup(i)`，只随场次号变、绝不随帧时间 t 变。
- `video/src/cli.mjs`：`hit`/`marks` 两个选择器补 `.secchip,.secbar`；新增第八项「同屏 N 根按场进度」。
- `.trellis/spec/video/`（新层：`index.md` + `layout-contract.md` 七段契约）、`spec/index.md` 补第四层表行、`spec/guides/index.md` 补「改成片版式时」四条 checklist。
- `research/`：`fill-probe.mjs` 扩 chip/杠读数 + 双平台截图 + 最差场列；新 `fill-sweep.mjs` 全量扫描器；`baseline-20261017.md` 补 §六–§八。`after-*`/`after-sec-*` 与 `baseline-*` 成对，被否的走法留 `lever-spacebetween-*.png` 两张反例。

**验证**

- 兼容性口径：无 `sections` 的旧集页头 DOM 一字不变；用 fixture 注入后 `video:check` 输出与不注入**逐位相同**，与改前基线只差两条 verdict 行。
- `npm run video:lint` 18 条全绿；`npm run video:check`（无参数，18 集 × 双平台 694 场）exit 0——CSS 注释定稿后又单独复跑一遍 `check-all18-shipped.txt`，仍 exit 0。
- `md5sum -c research/out-md5-before.txt --quiet` exit 0：`video/out/` 一字节未动，全程没对既有 18 个 id 跑 `video:build`。
- 两个故意失败证明新判据不是死代码（bilibili 也渲染 `.secbar` → `同屏 2 根按场进度`；42 字 chip → 竖版越界 + `loadEpisode` 契约拦截）。
- PRD 的 AC 按实测分档改写（card 达标、code/hook 的 0.70 换成「不许靠拆开内容换填充」、anim/outro 豁免、两平台分开），走 Phase 1 修订口径而非就地放宽。
- 归档之后补的一刀：`task.py archive` 把 `research/` 往下挪三层，spec 指过去的命令、`layout.mjs` 注释里的反例截图路径、两个探针脚本自己的相对 import 一起失效，改指 `archive/2026-10/` 并把相对深度从 4 层补到 6 层（每个 specifier 用 existsSync 验过落地）。

**待办**

- 本任务出口条件解除：`10-17-s5-systick-episode` 可以进 Phase 2 渲帧——S5 是第一个真正带 `sections` 的集，新页头的第一个观众就是它。
- 知乎 F5 频控窗口（10-17 21:07 之后）跑 `node .temp/f5-zh-publish.mjs`，闸门文件 `.temp/zh-run/I_HAVE_USER_OK=f5-sem-mutex` 留在原地。
- 抖音 F5 置顶需用户在 App 内长按；E04 上板要真板（COM4/COM5 是蓝牙虚拟口）；B站合集等权益中心 Lv2。


### Git Commits

| Hash | Message |
|------|---------|
| `1fa7d1d` | (see git log) |
| `69fd32a` | (see git log) |
| `78e67f6` | (see git log) |
| `83a292a` | (see git log) |
| `ce08dc7` | (see git log) |
| `29def0a` | (see git log) |

### Testing

- Validation was not recorded for this session.

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 8: 开小红书第四条投放线，F5 竖版笔记已发布

**Date**: 2026-10-17
**Task**: 开小红书第四条投放线，F5 竖版笔记已发布
**Branch**: `main`

### Summary

常驻浏览器 + 分步驱动 + 台账三件套落地：字段上限、话题 chip、封面三层入口全是实测量出来的；站外地址与超限拦在 fill 里，发布那一步仍归人点。F5 2026-10-17 15:32 已发布并回笔记管理核到。

### Main Changes

### 会话目标

新开第四条投放线：小红书竖版笔记，把 F5《信号量和互斥量》投上去。用户口径三条——只发 F5 一条试水、AI 起有头浏览器探入口、标题/正文/评论一律不出现站外地址与 GitHub 字样。

### 关键决定与实测

- **没有 API 通道，沿用常驻浏览器那套**：本机无任何小红书开放平台凭证，创作者后台发布接口未验过；入口实测在 `creator.xiaohongshu.com/publish/publish?target=video`，是个 SPA 表单。于是 `xhs-daemon.mjs`（复用 `.temp/douyin-profile` 与 9223 那个窗口，同一 user-data-dir 起第二个实例会被挡）+ `xhs-probe.mjs`（只读）+ `xhs-step.mjs`（分步驱动，十个 verb）。
- **上限只能自己量**：标题 20 字、正文 1000 字，且**都不在 DOM 强制**——喂 39 字进标题框，`input.value` 仍是 39，页面只把计数器印成「39 / 20」，拦的是提交。所以断言写进 `fill`：按码点断长度，任何字段命中 `https?://` 或 `github` 直接退出码 2。
- **话题必须是 chip**：正文里直接打 `#名字` 是黑字，不成话题；只有 `#名字` 之后弹出来的那条候选被接住才生成 `a.tiptap-topic`（带 `data-topic` 的 id 与 `xhsdiscover://topic/v2/...`）。接法用回车——上一版用 `locator('text=/^#FreeRTOS/')` 点候选，先匹配到的正是刚打进正文的那串黑字，三次"clicked"拼出「#优先 级反转斥锁RTOS」这种交错垃圾。
- **封面入口藏三层**：点默认封面缩略图（「设置封面」那四个字只是标题，点了没反应）→「编辑封面」→ 才有 `accept="image/png, image/jpeg, image/*"` 的 file input → 裁剪/模版/贴纸/文字/滤镜/标记 → 点「完成」才落定。应用后平台自己回「封面效果评估通过，未发现封面质量问题」。
- **发布成功的判据**：笔记管理 `/new/note-manager` 的「已发布」标签里有这条，且「审核中」「未通过」都是空的。发布后表单 URL 变 `?source=&published=true`、草稿箱归零，但那是事后信号不是回执。观众侧详情页从笔记管理点标题打不开（只选中、弹出页不导航），所以"有没有漏地址"的核对必须留在**发布前**：15:31 对编辑器正文与 `episode.json` 逐字比过，只差空行，两个外链正则双双「无」。

### 改动的文件

- 新增 `video/publish/xhs-daemon.mjs`、`xhs-probe.mjs`、`xhs-step.mjs`、`xhs-plan.md`（台账：实测事实表、与抖音四处口径差、闸门与工具布局、F5 已发布状态与证据）。
- `video/episodes/f5-sem-mutex/episode.json` 补 `publish.xiaohongshu`（title/body/topics/pinned/repro/noLink）；正文那句「（6000 / 2500）」改成「6000 与 2500」，因为它会被全页正则当成计数器。
- `.agents/skills/video-release/SKILL.md` 从三条线改成四条线：§2 新增小红书小节（入口命令 + 判据）、§3 四条失败信号、§4 导流口径、§5 运行态表行、§6 三个坑（常驻页不许关 / 全页正则读计数器 / SPA 要 settle）。

### 验证

- F5 那条 **2026-10-17 15:32 已发布**：笔记管理「已发布」有它（01:06，截图 `manager-已发布.png`），「审核中」「未通过」两标签空；创作者中心首页「最新笔记」也换成这条。发布键是人点的——`publish` 步查完闸门仍抛错，这一步至今没自动化，留痕 `.temp/xhs-run/f5-sem-mutex-published.txt`。
- 计数器读法改版后做过判别验证：合成一页「正文含（6000 / 2500）+ 两个真计数器」，旧的全页正则吐三条、新的只吐 `539 /1000` 与 `18 /20`（`.temp/xhs-counter-check.mjs`）；顺带量到一条事实——没传视频时空表单上一个计数器都没有。
- `xhs-probe.mjs` 真跑一遍：6.7 秒 exit 0。之前它收尾没有 `process.exit`，CDP 那条 websocket 挂着导致进程永不退出（上一版靠 timeout 掐掉）；探针默认 URL 也从已失效的 `/creator/home`（实测回「你访问的页面不见了」）换成活着的 `/new/home`。
- 三个脚本 `node --check` 全过；`episode.json` JSON 解析过；新增文件里除 `noLink` 那条自述外无 http/github 字样，cookie 只报条数不报值。

### 待办

- 置顶导流评论：用户选「先写工具我来发」，但探完的结论是**网页侧没有入口**——创作者中心十项导航里没有任何评论项，笔记行的「置顶」图标置顶的是笔记本身，公网 `explore/<noteId>` 直连回 `error_code=300031`（要 `xsec_token`），而这个 profile 只登录了创作者中心。出路两条：同一窗口再登录一次网页版后我量评论区写 `comment` 步，或手机 App 内发+长按置顶。证据与 noteId 在 `xhs-plan.md`。
- 合集：用户定「这轮先不建」——挂合集要走「编辑」，改已发布笔记可能重新进审核（B站有 `state=-6` 先例），等第二条上小红书再定名。内容类型声明与原创声明仍未选。
- 标题体例：账号既有条目是「STM32零基础自学N｜…」，F5 这条走的是「xSemaphore 一个函数都没有」，要不要统一得定。
- 知乎 F5 频控窗口 10-17 21:07 之后重跑 `node .temp/f5-zh-publish.mjs`；抖音 F5 置顶需用户在 App 内长按；E04 上板要真板；B站合集等 Lv2。


### Git Commits

| Hash | Message |
|------|---------|
| `018c542` | (see git log) |
| `7d6e750` | (see git log) |
| `758eaef` | (see git log) |

### Testing

- Validation was not recorded for this session.

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 9: 小红书置顶评论已发出、置顶入口实测不存在；合集挂载做到「选中」待人提交

**Date**: 2026-10-17
**Task**: 小红书置顶评论已发出、置顶入口实测不存在；合集挂载做到「选中」待人提交
**Branch**: `main`

### Summary

comment 步补 --go（闸门另起一张 I_HAVE_USER_OK_COMMENT）并真发出 138 字置顶评论；量到网页版评论菜单只有「删除评论」，据此不写 pin 步。合集名进 episode.json，新写 collection 步：认 tooltip「编辑」进 /publish/update、弹层按整段文本全等选中「STM32 零基础自学」，冷跑两次验到选中不落盘、提交那颗是 closed shadow 的 <xhs-publish-btn>，所以停在未提交等人点。

### Main Changes

### 做了什么

接上一轮小红书那条线的两个尾巴，都按"先实测再写代码"走完。

1. **置顶评论发出去了，并量到"置顶"在网页版做不到**
   - 用户点头「发送这条置顶评论」→ 给 `xhs-step.mjs comment` 补 `--go` 分支，闸门用**另一个文件**
     `.temp/xhs-run/I_HAVE_USER_OK_COMMENT=f5-sem-mutex`（不复用发布那张 `I_HAVE_USER_OK=<ep>`，两种授权混一起，以后谁看见它就以为发布也批过了）。
   - 实跑：138 字回填一致 → 点「发送」→ 评论框剩 0 字、列表按前 18 字找回这条 = 是。留痕 `f5-sem-mutex-comment-sent.png`。
   - 再按用户要求量置顶入口，结论是**否定的**：自家评论的「…」菜单里只有「删除评论」，整页扫不到「置顶」二字
     （`.temp/xhs-pin-probe4.mjs` + `comment-menu-open.png`）。据此**不写 `pin` 步**，与抖音同口径：置顶只能 App 内长按。
2. **合集：建好了，挂载做到"选中"为止**
   - 用户改口「可以创建合集了，另一个已经创建ok了」→ 合集名 `STM32 零基础自学` 进事实源
     `episode.json` 的 `publish.xiaohongshu.collection`（含一个半角空格，是弹层里 `div.item` 的逐字文本）。
   - 新写 `xhs-step.mjs collection`：笔记管理里 hover 图标认 tooltip「编辑」→ 新标签落 `/publish/update`（noteId 不抄进代码）
     → 点 `.collection-plugin-button` → `.d-popover .item` 按整段文本全等认领 → 回读整行文本 + 截图。**不点提交。**
   - 冷跑两次（中间关掉编辑页）量到两件事：选中**不落盘**（重开又回落「选择合集」）；判据只能读
     `.collection-plugin-wrapper` 整行文本，因为选中后 `.collection-plugin-button` 那个类会消失。
   - 提交那颗是 `<xhs-publish-btn submit-text=发布 save-text=暂存离开 is-publish=true is-save-draft=false>`，
     rect `220,740 680x90`，**closed shadow root**：全页 `getByText('发布',{exact:true})` 命中 0，x=240→880 每 40px 做
     `elementFromPoint` 全部命中宿主自身（坐标也点不准）；实例上只有 `_onPublish`/`_onSave`，那是绕过前端校验硬触发，不做。
     顺带一个撞名坑：左上角导航 `div.publish-video > .btn-wrapper` 文案是「发布笔记」。
   - 所以编辑页现在停在"已选中合集、未提交"，等人点那一下（`is-publish=true` 时点了等于把公开笔记重新提交，大概率再走审核）。

### 改了哪些文件

- `video/publish/xhs-step.mjs`：`comment` 补 `--go` + 独立闸门；新增 `collection` 步；`WEB_ONLY` 改 `NO_WORK_PAGE`（collection 走 `/publish/update`，不能被 `/publish/publish` 工作页认领抢走）。
- `video/episodes/f5-sem-mutex/episode.json`：`publish.xiaohongshu.collection` + `collectionNote`。
- `video/publish/xhs-plan.md`：置顶评论四条证据 → 已发出；新增「置顶这件事在网页版做不了」一节（四条证据 + 据此不写 pin）；「合集这轮不建」改成实测到的挂载链路与 `<xhs-publish-btn>` 契约。
- `.agents/skills/video-release/SKILL.md`：命令块加 `collection` 与 `comment --go`；判据三条（评论闸门另起一张、置顶做不到、合集挂载只到选中）；§3 加"选完重开又变回选择合集"一行。
- `.temp/xhs-run/f5-sem-mutex-published.txt`：评论已发（16:21）与合集选中未提交两条留痕。

### 验证

- `node --check video/publish/xhs-step.mjs` 过；`episode.json` JSON 解析过。
- `collection` 步冷跑两次全绿：`弹层里的可选项（1）：「STM32 零基础自学」` → `这一行显示合集名：是` → 打印 `<xhs-publish-btn>` 属性契约 → 明确停手没点提交。
- 探针全程只读：只 `page.close()`，没碰 `browser.close()`，常驻页与登录态没动。

### 待办

- 合集最后那一下提交归人点（编辑页就开着，选中状态在）；点完重开编辑页应仍显示合集名才算挂上。
- 内容类型声明与原创声明仍未选（属人工决定）。
- 知乎 F5 频控窗口 10-17 21:07 之后重跑 `node .temp/f5-zh-publish.mjs`；抖音 F5 置顶需用户在 App 内长按；E04 上板要真板；B站合集等 Lv2。
- 标题体例：账号既有条目是「STM32零基础自学N｜…」，F5 这条是「xSemaphore 一个函数都没有」，要不要统一得定。


### Git Commits

(No commits - planning session)

### Testing

- Validation was not recorded for this session.

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 10: 小红书合集线收口（建「通往单片机之路」、F5/S5 换集落盘）+ 视频系列 17 条批量上传全发

**Date**: 2026-10-17
**Task**: 小红书合集线收口（建「通往单片机之路」、F5/S5 换集落盘）+ 视频系列 17 条批量上传全发
**Branch**: `main`

### Summary

视频系列自建合集「通往单片机之路」建成、F5/S5 换集落盘（坐标点击+重开回读；S5 复审约 3-4 分钟后回稳）；用户「视频都要上传啊」后 17 条文案块从各集抖音稿派生（不新编）、xhs-batch.sh 逐集发布 17/17 零失败，「已发布」整列 43 张卡片对账逐条在列（=24 章+F5/S5+17 新）、3 条抽样合集行全中；发布点击改为 CDP 穿透量内部「发布」盒。

### Main Changes

### Summary

视频系列自建合集「通往单片机之路」建成、F5/S5 换集落盘（坐标点击+重开回读；S5 被复审拉到「审核中」约 3-4 分钟后回稳）；
用户「视频都要上传啊」后 17 条文案块从各集抖音稿派生（不新编一字），`xhs-batch.sh` 逐集发布，**17/17 零失败**，
「已发布」整列 43 张卡片对账逐条在列、3 条抽样合集归属全中；发布点击改用 CDP 穿透量内部「发布」盒。

### 做了什么

1. **状态核实（不抄前一条会话的说法）**：S5 已发布且已挂章节合集「STM32 零基础自学」
   （重开浏览器后经笔记管理「编辑」新开的页回读）；F5 未挂任何合集；账号弹层里只有 1 个合集；
   抖音那条线的视频合集叫「通往单片机之路」（mix，c3b 排第 5 集）。
2. **拍板（对话问答）**：新建「通往单片机之路」（给视频系列）＋提交那一下由我点（坐标点击+回读验证）＋立一个新任务。
3. **建合集**：`collectioncreate --ep=f5-sem-mutex --desc=屏上每个数都是本机跑的`——
   编辑页 → 加入合集 → footer「创建合集」→ 名称/简介 →「创建并加入」，回显「共1篇 成功创建」；
   闸门 `I_HAVE_USER_OK_COLLECTION=通往单片机之路`。中途两个坑都修进驱动：认领编辑页要按标题框逐字
   （F5 那步曾复用 S5 留下的页、把别人的合集行当自己的读）；「创建并加入」后立刻 reload 会撞 SPA 原生
   confirm（ProtocolError: No dialog is showing）——统一挂 dialog 监听。
4. **换集并提交**：`collection --ep=f5-sem-mutex --go` / `--ep=s5-systick --go`——真实点击 (560,789) →
   F5 回读「更新成功」、S5 toast 偶发没读到 → 两条**重开编辑页回读那一行=「通往单片机之路」（落盘）**；
   笔记管理里两条都在「已发布」；**S5 被拉回「审核中」约 3-4 分钟后转回「已发布」**（播放数 51 不变），
   F5 同批没有——`is-publish=true` 的提交何时引复审平台不保证。
5. **17 条批量上传**（用户「视频都要上传啊」→ 选「今晚 17 条连跑全发」）：
   - 文案块派生：标题=抖音候选里最短 ≤20 字（f0/p4 两条人工指定；p4 三条候选全超 20）、
     正文=抖音 `intro` 去掉含 站内/全篇/全文/免费/仓库/通往单片机之路 的句子 + 尾巴「复现：<repro>」、
     置顶=抖音 `pinned` 同规则删句、话题=tags 前三个、合集=通往单片机之路。
     插入按**花括号配平定位 publish 对象**（根键顺序不定：c4 的文件尾是 platforms 的收尾，
     按尾锚会把块插进 platforms——被「除新块外一切不变」的守卫拦下）；文件是 CRLF，逐文件取 EOL。
   - `video/publish/xhs-batch.sh`：逐集 `open→upload→fill→topics→coverset→coverapply→attach→publish --go`，
     任一步非零即停；逐集闸门 `I_HAVE_USER_OK=<ep>`（内容=用户原话+该集 id）。
   - `attach` 在**发布表单**上把合集选好（发出去一并落盘，省掉发完回编辑页补一遍）；
     `publish --go` 的点击用 **CDP `DOM.getDocument(pierce:true)` + `DOM.getBoxModel`** 量内部「发布」盒
     （573..693 × 769..809 → 点 (633,789)）——宿主 rect 221..901 的正中 (561,789) 落在
     「暂存离开 429..549｜发布 573..693」之间的**空隙**上，点它什么都不发生（第一次白点过一次）。
   - 结果：**17/17 发布成功、零失败**（c3-volatile 单跑 + 16 条批跑 1608s）；笔记管理「已发布」
     整列 **43 张卡片**收齐（= 24 章 + F5/S5 + 17 新），新 17 条 22:22–22:49 逐条在列。
6. **核对工具的两个坑**（写进 xhs-plan）：笔记管理**搜索框会偶发返回空结果**（同一前缀换个时刻能命中）——
   别当唯一判据；该列表是**虚拟列表、只渲染可视区约 10 条**，`PageDown`/滚轮/scrollTop 单用都不动，
   要 **Ctrl+Minus 缩小 + 三种滚动齐上**才收得全 43 条。
7. **抽 3 条核合集归属**：f0-why-rtos / c3-volatile / f6-timers 编辑页回读那一行全部=「通往单片机之路」✓。

### 改了哪些文件

- `video/publish/xhs-step.mjs`：+`collectioncreate` / `attach` / `publish --go`、`collection --go`；
  `claimEditPage`（按标题框认领）、`findPublishButtonBox`（CDP 穿透）、dialog 监听、
  `openCollectionPicker`（入口两态回退）。
- `video/publish/xhs-batch.sh`（新）：逐集跑批。
- `video/episodes/<17 集>/episode.json`：+`publish.xiaohongshu` 块（派生稿）；`f5/s5` 的 `collection`
  改「通往单片机之路」并更新 `collectionNote`。
- `video/publish/xhs-plan.md`：合集一节重写、批量一节新增（含结果与核对坑）、四处旧口径改写。
- `.agents/skills/video-release/SKILL.md`：命令块加 collectioncreate/--go、attach、publish --go、xhs-batch.sh；
  发布/合集两条判据重写；§3/§6 补今天的三个坑。
- `.trellis/tasks/10-17-xhs-series-collection/`（收口，AC 全勾+执行记录）、
  `.trellis/tasks/10-17-xhs-series-upload/`（新建：PRD+AC 全勾）。

### 验证

- S5/F5 落盘：重开编辑页回读（含浏览器重启后新开页）；点击坐标与 toast 回读记录在案。
- 批量：16 个「完成」标记 + 17 条 `published=true`；「已发布」整列对账；3 条抽样合集行回读。
- `node --check video/publish/xhs-step.mjs` 过；17 份 episode.json 的深比对守卫（除新块外一切不变）全过。
- 期间浏览器窗口无预警掉了三次（第三次由定时任务占用同一共享 profile 的嫌疑最大）——每次重启 daemon 后继续，
  产物均在服务端，未影响结果。

### 待办

- S5 置顶评论未填未发（发送需 `I_HAVE_USER_OK_COMMENT=s5-systick` 的对话点头）；17 条新笔记的评论区置顶
  只能在 App 内长按做。
- 内容类型声明 / 原创声明：F5、S5 两集都没选（属人工决定）。
- 笔记管理虚拟列表的核对方式已写进 xhs-plan，下次别再用"搜索一次没命中"下结论。


### Git Commits

| Hash | Message |
|------|---------|
| `e09345e` | feat(publish): 小红书视频系列 17 条上传全发，合集「通往单片机之路」建成收口 |
| `0212cf3` | docs(publish): 批次核对口径修正——43=24 章+F5/S5+17 新、抽样 3/3、核验记为整列对账 |
| `cfbe246` | chore: record journal |

### Testing

- `node --check video/publish/xhs-step.mjs`：过（当晚批跑与两次发布点击都由这一版驱动完成）。
- 17 份 episode.json 的生成守卫：按花括号配平插入 + 写回后 JSON.parse 深比对「除新块外一切不变」，全过。
- 发布：17/17 每条日志都有 `URL 已 published=true`；批日志 16 个「完成」标记、零错误行。
- 权威核对：笔记管理「已发布」整列 43 张卡片收齐（=24 章+F5/S5+17 新）逐条对；截图 `xhs-manager-scrolled2.png`（标签 active 已复核）。
- 合集归属：f0/c3-volatile/f6-timers 编辑页回读合集行 3/3 =「通往单片机之路」。
- 落盘回读：F5/S5 换集后重开编辑页那一行=合集名（含浏览器重启后新开页）。

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 11: xhs 驱动改进：虚拟列表扫卡、只读 collectioncheck、xhs-verify 整列对账与台账对齐

**Date**: 2026-10-18
**Task**: xhs 驱动改进：虚拟列表扫卡、只读 collectioncheck、xhs-verify 整列对账与台账对齐
**Branch**: `main`

### Summary

把当晚靠临时探针硬啃的手法固化进驱动并清掉 6 处旧口径；最难用例与 19/19 复核全过

### Main Changes

- `xhs-step.mjs`：`claimEditPage` 换成**虚拟列表扫卡**——Ctrl+Minus 缩小 ×4，再用 PageDown / 滚轮 / scrollTop 三种滚动轮着来（上限 25 轮），
  认领到编辑页后 Ctrl+0 还原缩放。背景：笔记管理是虚拟列表、只渲染可视区约 10 条，旧逻辑在"目标卡不在首屏"时直接报「没有卡片」。
- `xhs-step.mjs`：新增只读 `collectioncheck --ep=<ep>`——认领编辑页 → **重载读服务端** → 回读合集那一行，PASS/FAIL、退出码 0/4、
  截图 `<ep>-collectioncheck.png`；并把它并进 `NO_WORK_PAGE`（原来会顺手认领/新开一张 /publish/publish 发布页，纯只读核对不该有副作用）。
- `xhs-step.mjs`：`comment` 步在 profile 主页找卡加**有界滚动兜底**（6 轮 × 3 种滚动），评论流不再只认第一屏。
- 新增 `video/publish/xhs-verify.mjs`：**整列对账**替代搜索式核验——默认核所有带 `publish.xiaohongshu` 的集（可 `--eps=a,b,c`），
  收全「已发布」列表按标题对账，落标签容器 `tab-item--active` 类名做证据，列表头总数只作动态记录、不当完整性基准，退出码 0/1/2，
  用完还原缩放再关自己的页（缩放是 origin 级，别带进常驻页）。
- 台账收口（6 处旧口径与实装对齐）：xhs-plan 发布步说明、comment 头注（「不给 --go」→ 默认只填/`--go` 可代发）、`NO_WORK_PAGE` 集合、
  S5 评论状态（未填未发 → 已发）、评论一节标题、xhs-verify 条目去掉已废的「⚠」说法；SKILL 命令块与判据同步。
- **现场事实**：核对时列表头 43→44→45 边跑边涨，是 **ops 线并发补发它审计出的 ch24/ch25**（用它自己 CDP 量的按钮坐标发的）；
  那晚 23:3x 的账 45 = 26 章 + 19 条视频，是快照不是最终数——这也是把「总数」降级为动态记录的直接原因。


### Git Commits

| Hash | Message |
|------|---------|
| `22cfba3` | feat(publish): xhs 驱动——合集只读复核 collectioncheck + 虚拟列表扫卡（缩小+三种滚动） |
| `61942e7` | feat(publish): 小红书发布核对常设化——xhs-verify.mjs（整列对账替代搜索式核验） |
| `bb293bf` | fix(publish): 三处自相矛盾——collectioncheck 并入 NO_WORK_PAGE、comment 头注对齐 --go、S5 评论状态改实录 |
| `60f048c` | docs(publish): 台账三处收口——评论线标题改实际行为、核对工具条目去掉已废的⚠口径、并发数注明为当晚快照 |

### Testing

- `collectioncheck --ep=c3-volatile`：44 条列表里扫到第 17 位那张卡（最难用例），重载回读合集行 =「通往单片机之路」、归属 是（72.9s）。
- `collectioncheck --ep=s14-pwr`：通过（57.4s），顺带验到「别的笔记的编辑页不碰」分支；并入 `NO_WORK_PAGE` 后复跑仍过。
- `xhs-verify.mjs`：两跑 **19/19 全中**（含 F5/S5 回归）；标签 `tab-item--active` 类名逐跑落证；总数只作动态记录、不参与判定。
- `node --check video/publish/xhs-step.mjs` 与 `video/publish/xhs-verify.mjs`：全过。

### Status

[OK] **Completed**

### Next Steps

- None - task complete
