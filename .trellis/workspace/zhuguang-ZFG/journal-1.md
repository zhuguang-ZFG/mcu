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
