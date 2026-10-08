# 质量与复现契约

## 1. Scope / Trigger

修改工程、章节元数据、实验状态、部署流程或搜索/语法高亮时，适用本合同。

## 2. Signatures

- `npm run quality`：单元回归、工程清单、站点构建、动画、README、链接、导航可达性、分享/收录元数据。
- `npm run nav:check`：扫描全部页面，检查每个页面都能从 `config.mts` 的 nav/sidebar 到达（页面→入口方向，正是死链检查的反面）。
- `npm run seo:check`：检查构建产物含 sitemap.xml（每条 `<loc>` 必须带 `host+base` 前缀）、robots.txt、og-cover.png，且每页都有 og/twitter 分享卡与 canonical。需先构建。
- `npm run firmware:check`：ARM/host 全工程、五场景切换、初始 SP 与 Thumb 复位向量验证。
- `npm run test:browser`：构建后运行；先 `npx playwright install chromium`。本机可 `PLAYWRIGHT_CHANNEL=msedge`。
- `npm run site:measure -- current [output-directory]`：测量产物与搜索延迟加载，默认输出 test-results/performance。
- `node scripts/project-catalog.mjs --matrix`：仅向 stdout 输出 JSON `{include:[{path,target}]}`，供 CI 消费。

## 3. Contracts

- `code/projects.json` 数组：`id` 唯一；`path` 为 `code/<board>/<project>`；`kind` 为 arm-make/esp-idf/host-probe/host-make；`entry` 必须存在且与类型一致。ESP 的 `target` 必须是 esp32s3，RTOS `scenes=[1,2,3,4,5]`。
- 章节：title 非空字符串，status=done/building，difficulty=1/2/3，minutes 正整数。非法值使生成进程非零退出，不能降级为告警再产出数据。
- 实验额外字段：code_status=ready/planned、hardware_status=pending/verified、code_note 非空、projects 为工程 ID 数组。ready 必须引用工程；verified 必须有 docs/ 下的 evidence 文件。
- status 只表示文稿；LabStatus/LabOverview 从元数据与 progress.json 显示时长、难度、代码状态和实测状态。禁止将成稿数说成实测数。
- 部署调用本地 reusable quality workflow；deploy 必须依赖其全部 jobs 成功，且目标为 main。PR 只读权限，不得 continue-on-error 放行必需检查。
- 搜索索引只在打开搜索时加载；索引正文/行内标识符，完整代码块从索引中剔除。ld/gdb 由 code-languages.mjs 的 TextMate 规则渲染。

## 4. Validation & Error Matrix

| 输入/事件 | 结果 |
|---|---|
| 空目录 | 不计工程 |
| 有构建入口但未登记 / 路径失效 / 重复 ID | 报错 |
| minutes=0、difficulty=4、status=finished | 报错 |
| 实测 verified 但无证据 | 报错 |
| 任一 CI job 失败/取消/跳过 | 不部署 |
| 搜索产物 raw >500 kB | 保留告警，记录 gzip/Brotli/首屏请求，不能单纯调阈值 |

## 5. Good / Base / Bad Cases

- Good：E07 文稿 done、代码 ready、硬件 pending，有独立工程和精确接线。
- Base：E04 文稿 building、代码 planned、硬件 pending，明确这是实验方案。
- Bad：八篇实验都 done 因而写“八项已实测”；给未构建目录冠以“可构建”标签。

## 6. Tests Required

- tests/catalog.test.mjs：空目录、失效入口、未登记工程、重复与目标错配。
- tests/nav.test.mjs：sidebar 全量（正例）、漏登记被拦截（反例，GD32 回归）、锚点/尾斜杠归一。
- tests/seo.test.mjs：meta 抽取与空值、单页分享卡齐全、og:image/url 必须绝对 URL、sitemap 丢 base 前缀被拦截（反例）、robots 缺项。
- tests/metadata.test.mjs：缺项、非法数值/枚举、重复 YAML 字段。
- tests/workflow.test.mjs：同提交依赖关系、PR 权限与失败传播。
- tests/search.test.mjs、tests/browser/site.spec.mjs：高亮实际 token、保留正文、搜索结果、延迟索引、暂停/减少动效、移动端实验卡。
- scripts/check-firmware.mjs：场景 1→2→1 的真实二进制、flash 路径、非法场景拒绝；二进制开头 SP/Reset 与 ELF 符号对应。GD32 可将向量表并入 .text，不能仅依赖输出节名。

## 7. Wrong vs Correct

- Wrong：改 `-DDEMO_SCENE` 却共用 build/main.o。Correct：build/scene-N 隔离，Makefile/头文件更新重建。
- Wrong：汇编只写 `.thumb` 就认为向量里的地址带 Thumb 位。Correct：Reset_Handler 标记 `.thumb_func`/function 类型，并核验 bin 第 4 字节起的复位字最低位为 1。
- Wrong：往 N16R8 GPIO35 输出 PWM 证明它被占用。Correct：以模组资料核对；示例只在 GPIO10/11 路由，并先 gpio_reset_pin 断开旧输出。
