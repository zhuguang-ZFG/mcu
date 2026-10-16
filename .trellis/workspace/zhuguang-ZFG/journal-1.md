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
