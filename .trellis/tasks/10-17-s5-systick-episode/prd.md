# 第 18 集 S5 SysTick：从取证复核到两平台成片

## Goal

把 `docs/stm32/05-systick.md` 做成第 18 集：B站 16:9 完整版 + 抖音 9:16 短版，
屏上每一个数都能由观众在本机 `sh probe.sh` 复现。选题于 2026-10-17 定档，
已写进 `video/series.json` 的 `next`。

## Why This Chapter

- 先修 S4（NVIC/EXTI）已投，S4→S5 是这条线上第一条不断链的顺接；
- 接住刚投完的 FreeRTOS 弧欠下的那句：F3 调度器靠 tick 走，tick 到底谁给的；
- 本集全部取证不需要开发板——这是当前 80 章里少数几条「今天这台机器就能拍全」的。

## Requirements

- 唯一事实源：`video/episodes/s5-systick/episode.json`（`id: s5-systick`、`badge: S5`、`no: 18`），
  产线六阶段顺序固定 `lint → tts → timeline → stage → mux → package`，入口是
  `npm run video:lint / video:check / video:build -- s5-systick`。
- 屏上数字一律取本机实跑（`video/series.json` 的 `format.rule`）。已验证前提：
  2026-10-17 本跑 `code/stm32/05-systick/probe.sh` → **宿主断言 42/42 全绿**，
  交叉段 `arm-none-eabi-gcc 10.3.1` 出 `probe-arm.o`（text 3297 / data 0 / bss 8），
  机身可见 `movw r2,#16799`、`movw r1,#22783`、`movw r6,#6000`。
- 交叉编译那一段要求 `arm-none-eabi-gcc` 在 PATH；没进 PATH 时脚本只跑宿主段，
  屏上就不许出现目标文件里的常数（读不到就是没有，不许从旧日志里搬）。
- 钩子候选（都已在本次实跑里读到具体值，不是推算）：
  1. COUNTFLAG 读清——周期到后第一次读 CTRL=`0x00010005`、第二次=`0x00000005`；
     5 个周期里单读法数到 5 次、「先偷看再查」双读法数到 **0 次**，延时死等（probe [7]）；
  2. 忘减一的代价不在次数在相位——同跑 1680000 周期两边都重载 10 次，
     但每 tick 慢 1/168000（5.95ppm）、**日漂移 514ms**（probe [3]）；
  3. 24 位上限装不下 100ms——`SysTick_Config` 返回 1 拒配；强行 `&0xFFFFFF` 得 LOAD=22783，
     tick 变 135.6µs、**ISR 快 737 倍**（probe [4]）；
  4. `SysTick_Config(168000)` → LOAD=167999 / VAL=0 / CTRL=0x00000007 / SHP[11]=0xF0
     即逻辑优先级 15，正好接 S4 那套优先级账（probe [6]）。
- 竖版短版按 F5 那条集的先例独立重排（钩子前置、每幕一句、金句收尾），不是横版缩放；
  横版图动画进竖屏前先量等比缩放后标题与字幕挤不挤得下。
- 发布稿由产线 `writeRelease` 生成，投放走 `video-release` 技能那三条线，本任务不出投放动作。

## 硬约束

- **文档「实物实验」那两节（逻辑分析仪测 PF6 的 500ms±0.1%、调试器 watch 触发双读坑）需要上板，
  当前板子不在位。** 没有本集实拍的串口/逻辑分析仪留档，就不许把 ±0.1% 这类数当实测放上屏，
  也不许拿理论周期冒充测量值；要么整段不拍，要么标成「这一步要板子，屏上给的是命令而不是数」。
- 已发布的 18 条成片与发布稿不许回炉：本任务不得改动 `video/out/` 既有目录与 `video/episodes/` 既有集。
- **渲染顺序**：`video:build` 要排在 `10-16-video-layout-header-fill` 落地之后。
  那两条版式改造（常驻页头带小节信息、内容块纵向铺满）只对未发布新集生效，
  S5 是第一个载体；先渲后改就等于改版再拖一轮。
  排版审计（越界/裁切/压字幕/相叠/字号/顶穿/孤字）必须在改版后的版式上跑到 0。
- 片尾 CTA 待定：F5 把「那两个毫秒数得上板子、那张表还空着」悬给了观众（对应
  `10-16-e04-board-measurement`）。S5 是接这一句、还是转向本集的复现路径，由用户在 1.4 复核时定；
  无论选哪种，都不许在 CTA 里把 E04 的模型值说成已有实测。

## Acceptance Criteria

- [ ] `video/episodes/s5-systick/episode.json` 存在，`no: 18`、`badge: S5`，
      每场 `kicker` 带小节信息（版式页头要吃这个字段）。
- [ ] `npm run video:lint -- s5-systick` 通过；`video:check` 的排版审计全 0。
- [ ] 两平台成片时长落在 episode.json 的 `targetSec` 区间内，h264@30 + aac 44100 立体声，
      响度与前几集同口径（F5 实测 -15.0 / -15.1 LUFS）。
- [ ] 屏上每个具体数都能在本次 `probe.sh` 输出里逐字找到；找不到的一律删掉或改写成「要板子」。
- [ ] `video/series.json` 的 `episodes` 补第 18 条、`next` 清空，且既有 18 条字段不被顺手改动
      （尤其 `series` 值本身没有尾空格，别按 `10-16-bili-season-after-unlock` 那条过期说法去「对齐」）。
- [ ] 既有 `video/out/*` 与既有发布稿的 md5 与开工前一致。

## Notes

- 交叉工具链 PATH 例：`/d/zhugu-home/tools/armgcc/xpack-arm-none-eabi-gcc-15.2.1-1.1/bin`
  （probe.sh 头部注释里写的那条），本次实跑用的是 10.3.1。
- `code/**/build/` 与 `.trellis/ref/` 都在 `.gitignore` 里：屏上引用产物只能给命令 + 现场读数，不能给站内链接。
- 站内这一章有现成动画 `/anim/systick-tick.svg`（倒数与 COUNTFLAG），与 F5 那两张横图的竖屏问题同一类，用前量一次。
