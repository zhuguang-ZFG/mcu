---
title: 更新日志
---

# 更新日志

> 🎯 一个教程最怕"看起来写完了"。这一页把每次改了什么、哪些坑还开着写清楚——未完成的部分站内一律标"建设中"。

站点统计（成稿章节 / 实验 / 动画 / 工程数）由 `npm run docs:gen` 扫描全站章节 frontmatter 得出，[首页学习地图](/)与本页同源。

## 2026-10-10 · 口径对齐：首页数字改由数据驱动 · 短自测 4 → 8 章

> 本次发布（两提交）的完整摘要与 CI 证据见 [发布摘要 · 2026-10-10（第二次）](releases/2026-10-10-2.md)。

- **首页三处过时口径修复**：GD32 卡片还挂着"建设中"、`linkText` 还是"看看规划"，而 G 篇早已 10/10 成稿；[关于我们](about.md) 的 HAL 引证行只列了 S2/S7 两章（实际 S6/S8 也已对账留证）、V 篇仍标"建设中"。逐处按当前事实改写——这类"站自己没跟上自己"的矛盾比错一个寄存器位更伤信任。
- **Hero 统计数字收编进 progress.json**：首页 Hero/特性卡/底部 CTA 的"80 章 · 97 张动画 · 41 工程 · 8 实验"是手写的，动画加到 100 后首页悄悄落后了 3 张——而首页自己就写着"统计由 `docs:gen` 得出"。现 `McuHero`/`McuFeatures`/`McuCta` 三个组件统一 `import progress.json` 渲染，数字从此与学习地图同源，加动画不会再漏改。
- **短自测扩到 8 章**：S7 USART（BRR 实算、TC 与 RS-485 换向、IDLE 清除顺序）、S8 DMA（DMA2 选流、环形 NDTR 重装、EN=0 窗口）、F4 队列（信号量=队列的退化、FromISR 三件套、立即 Yield）、C3 volatile（as-if 删除、RMW 非原子、asm volatile 独立防线）各 5 题，全部只考本章推过的数与判过的位，选项里的错误项取自正文点名的坑。

## 2026-10-10 · 对照表配动画：HAL 对账三张 · 一张旧图修版式

> 本次发布（三提交）的完整摘要与 CI 证据见 [发布摘要 · 2026-10-10](releases/2026-10-10.md)。

- **S6/S7/S8 的 HAL 对照表各配一张对账动画**（全站动画 97 → 100）：[tim-hal-init-path.svg](/anim/tim-hal-init-path.svg) 把"手写四步"与"HAL 三函数"并成三列逐寄存器点亮，`EGR=UG`、"先清 CC1E 再改 CCMR"这些对照结论直接画在时间轴上；[uart-hal-init-path.svg](/anim/uart-hal-init-path.svg) 沿 MspInit → SetConfig → 使能 的顺序点亮 CR1/BRR 各段，OVER8 与模式位同批写入单独标警；[dma-hal-en-window.svg](/anim/dma-hal-en-window.svg) 四张卡片走"正在传输 → EN=0 可改窗口 → 一笔落 CR → Start 写参数"，手写的 `while(EN)` 死等与 HAL 的 5ms 兜底在同一个窗口里对比。三张图锚点沿用 §八/§七 表格的 `1f6451c` 行号，正文在对照表后就地插图。
- **一张旧图进 CI 字体口径被抓**：`vtaskdelay-lifecycle.svg` 本地全绿，`--font-scale 1.10`（模拟 CI 的 Linux 字体）下 Task C 的名称与状态标签同行基线相撞 4px——把状态标签移到名字下方右角，与 A/B 两卡的错位排版一致。100 张在 1.10 口径下全部通过。

## 2026-10-10 · 上游对照补全：HAL 逐行落位 · 一处选流事实错误

- **S2/S6/S7/S8 的"待补"清账**：四章末尾的"上游 SPL/HAL 同名初始化：未取到源文件"沿用自初稿，实际 `stm32f4xx_hal_driver @ 1f6451c` 的 rcc/uart 源码早已存档，本轮补齐 tim/dma 两份后逐行核对，四章新增 HAL 对照表（带源文件行号锚点）——TIM 的 `EGR=UG` 影子值装载、UART 的 TXE 逐字节/TC 收尾、DMA 的"先等 EN 落下再改 CR"，手写代码与库函数在位级别对上了。**SPL 仍诚实标缺**：StdPeriph 未随 ST 官方 GitHub 分发，位定义落点保持 RM0090。
- **S7 事实修复**：正文把 `03-uart-dma` 工程的接收流写成 `dma1_stream5_rx_init / DMA1 Stream5`，与工程源码和 S8 的总线分工（USART1 在 APB2 → DMA2）矛盾——已按源码改为 `dma2_stream5_rx_init / DMA2 Stream5 Channel4`，并回链 S8 说明"为什么不是 DMA1"。
- **工程卫生**：三个 ESP32 教学工程入库的 `sdkconfig` 是本机陈旧生成物（`CONFIG_IDF_TARGET="esp32"`，与 `sdkconfig.defaults` 的 esp32s3 冲突，克隆后直接 `idf.py build` 会报 target 不一致），解除跟踪并更新忽略规则；sdkconfig 从此一律由构建再生。

## 2026-10-10 · 可靠性三章补厚

- **C8 / S17 / P13 从 15 分补到 45～55 分**：上一轮阅读时长校准暴露这三章正文偏薄，只有结论没有推导。现按章节规范补全。[C8 串口协议](../c/08-framed-protocol.md)：一组 INFO 帧手算 COBS 和 CRC，可以用 Python 独立验算；补齐接收状态机转移表、超时边界 99/100/101、两板字节来源（F407 DMA 的 HISR 位、S3 的事件加轮询）、TX 背压和服务层应答顺序。[S17 看门狗](../stm32/17-watchdog-reset.md)：IWDG 超时按 LSI 17/32/47kHz 三档给出 1.36～3.76s 的区间（DS8626 表 35、RM0090 表 107），WWDG 窗口算到毫秒，四种 MODE 各给一条复位时间线，再加 RCC_CSR 先读后清和 DBGMCU 冻结位只能断电清零。[P13 健康监督](../esp32/13-watchdog-health.md)：四种看门狗的分工、为什么只注册一个 health user、跨核时锁内读时间的竞争实例、`init` 返回 `INVALID_STATE` 时改用 `reconfigure`，还有 OpenOCD 断点关狗后不会再打开。三章都只给按代码周期推出的时间模型，实测值留在"实验记录"表里，标为待上板。
- **参考文献加 D13**：Cheshire & Baker 1999 COBS 原始论文，DOI 已经过 Crossref 核对，C8 的延伸阅读指向它。

## 2026-10-09 · 可查证：参考文献总表 · 动画在慢机器上也能跑

- **参考文献总表（此前没有）**：全站"手册说""标准规定""论文证明过"散落在各章，没有一处写明**哪一版、哪个 DOI、代码固定在哪个 tag**。新增 [参考文献](bibliography.md)，六个分区：A 芯片与内核文档（RM0090 Rev 22、DS8626 Rev 12、GD32F4xx UM Rev 3.0、Bumblebee Rev 1.0……核过 PDF 的才写修订号，没核的明标"未核版本"）、B 总线协议（UM10204 Rev 7、SPI Block Guide V03.06、ULPI 1.1、CAN 2.0/ISO 11898-1……）、C 语言与工具链（N1570、MISRA、TIS ELF 1.2、AAPCS32、AN298、RISC-V 20191213/20211203……）、D 经典论文 12 篇（Liu & Layland 1973、Sha 1990、TLSF 2004、Wilson 1995、Lamport 1977、McCreary & Gray 1975、Eide & Regehr 2008、Wang 2013、Koopman 2004、Dijkstra 1965……**DOI 全部经 Crossref 核对**题名/刊物/年份/页码）、E 书、F 代码基准。22 个成稿章节在"你做到了"之前新增**延伸阅读**，用 `[D2]` 标签指回总表——每条都写清"这篇和本章哪一句有关"，不是书单。**诚实标出的缺口**：RT-Thread 在 CI 里稀疏检出 `master` 而非固定 tag，R 篇行号可能漂移（F8）。
- **演示中心在慢机器上从 3 fps 到 55 fps**：CI 画廊用例连续两次超时，本地 12× CPU 节流复现——69 条 SMIL 时间轴同时跑在主线程上，帧率掉到 3 fps，任何靠 rAF 的等待都饿死；手机上打开这页也是同样的卡。现在 `AnimFigure` 用 IntersectionObserver 对视口外（含 200px 预载带）的图 `pauseAnimations()`、回视口接着走（时间轴不丢、按钮不变）；SMIL 在 document `load` 就开跑、早于水合，所以 `<head>` 里再放一段内联脚本按同一口径先停一遍；进度条改动 `transform` 不动 `width`。浏览器用例改为 `expect.poll` 轮询并断言页尾图已自动停；CI 失败时上传 Playwright trace 留证。
- **阅读时长按字数校准（此前凭感觉填）**：同一张学习地图上，两章正文字数相当、标注时长却差三倍——S17 看门狗正文不到 2000 字标 45 分，G2 GPIO 复用 1.2 万字标 30 分，读者据此排计划会被坑。新增 `scripts/reading-time.mjs`，模型 `正文/300 + 代码/150 + 10`（quick win 动手时间），`## 附录…` 里的 probe.c 全文这类备查材料不计；偏离 ±40% 的 23 篇改用模型值，通读总时长随之重算。`npm run reading:check` 进 `quality`，新章节标错时长 CI 会拦。顺带暴露三篇正文偏薄（S17、E13、C8 现为 15 分），留作内容补强。
- **动画版式审计进 CI，按 Linux 字体度量**：`anim:audit` 命令行化并在 CI 的 ubuntu 上跑，首次就抓到本地全绿、CI 红 8 张——图里声明的 `'Segoe UI','Microsoft YaHei'` 在 CI 上没有，Chromium 退回 Noto Sans CJK，同一行字宽 2%（纯中文）～10%（等宽代码/十六进制）。审计加 `--font-scale`（只放大字宽、绕 text-anchor），**本地 `--font-scale 1.10` 全绿即可认为 CI 必绿**；按此标准改了 19 张（断行优于缩号）。经验规则写进 `animation.md` §7。

## 2026-10-08 · 极其精品：传播力 · 可证性能 · 无障碍 · 可信度

前一天的打磨把「内容」做到位了，这一轮补的是**工程与传播层面**——实测发现四处"够不到顶"的地方，逐项补齐并都加了防回退闸门。

- **传播力（此前为 0）**：线上实测 `sitemap.xml` 与 `robots.txt` 双双 404，`<head>` 里没有任何 `og:` / `twitter:` 分享标签、也没有 `canonical`——链接发出去是一张白板卡。现已开启 sitemap（106→108 条 URL）、补 `robots.txt`、每页注入 og/twitter 分享卡与 canonical，并确定性生成 1200×630 分享图（`scripts/gen-og-cover.py`，非 AI 生图，中文不乱码）。**踩到一个真坑**：VitePress 的 sitemap hostname 必须含 `base` 且带尾斜杠，否则所有 URL 会丢 `/mcu/` 前缀——已加反例测试锁死。
- **可证性能**：`site:measure` 要启动浏览器，跑不进 `quality` 快线，体积回退一直没人守。新增纯静态 `perf:budget`（zlib，无浏览器），盯住首屏外壳+CSS、渲染阻塞 CSS、最大单块、搜索索引四项预算（当前 80.0 / 19.2 / 506.7 / 2979 KB，均在预算内）。行为侧（延迟索引、减少动效）仍由 `test:browser` 覆盖，两者分工不重叠。
- **无障碍**：此前只有 `prefers-reduced-motion` 与图片 alt 达标，缺防回退。现补 skip-link（跳到正文）、`:focus-visible` 品牌色焦点环（深浅主题自适应），以及 `a11y:check` 静态审计（lang / img alt / 按钮与链接可访问名 / h1 / 地标）。
- **可信度机制**：新增[上板验证与回填指南](../guide/verify-on-hardware.md)——四步流程（读卡→构建→记录→回填）+ 证据文件模板 + 常见疑问；实验总览表前显示「X / N 已实测」进度与入口。**刻意不为之**：没有真板子就不改 `hardware_status`，CI 的 metadata 校验也会拦下无证据的 `verified`。
- **中文搜索（此前部分失效）**：实测搜「优先级反转」「上下文切换」「链接脚本」「等待周期」**全部 0 结果**——尽管这些词就在正文里。根因是 MiniSearch 默认按空白/标点切词，一整段中文被当成 1 个 token，只有落在段首的词能靠 `prefix` 命中。现改为对连续中文切二元组（`scripts/search-tokenize.mjs`，构建端与浏览器端共用同一函数），这四类查询现各有上百条命中且 top3 命中正确章节。代价是索引 brotli 391 → 507 KB（按需懒加载，首次搜索才下载），预算已相应上调并在脚本里写明原因。另加 `seo:check` 闸门：一旦有人误删分词配置，中文搜索不会报错、只会"静默失效"，现在 CI 会拦下。
- **404 页**：此前是 VitePress 默认的「404 Not Found」，连 h1 都没有。改为带搜索提示、常见目的地、按板块直达的兜底页。
- **术语速查补齐**：审计发现高频术语缺独立条目——`GPIO` 全站出现 388 次却只有 ESP32 的「GPIO Matrix」，I2C/SPI/USART/ADC/DAC/TIM/PWM/RTC/UART、FreeRTOS/RT-Thread、RCC/tick/FPU/CMSIS/SPL、RISC-V/Bumblebee/CLIC/MTIME 均无条目。补 21 条（收录 90 → 117），风格保持「一句话 + 别误会成 + 深读」。
- **尚开着的坑**：8 个实验 + 2 个综合项目的**上板验证仍是 0 项**——这是本站当前最大的信任缺口，需要真板子与仪器，欢迎按新指南回填。

## 2026-10-08 · 精品化四维打磨：看得懂 · 找得到 · 学得下去 · 有兴趣

- **找得到（硬伤）**：`config.mts` 的 GD32 侧边栏只列了 10 章里的 1 章，`G0/G2/G3/G4/V0–V4` 共 9 章**全站没有导航入口**。已补齐为 G 篇 + V 篇两组。更重要的是加了 `nav:check` 闸门：它查的是「页面 → 入口」方向，正好补上 VitePress 死链检查的反面——以后任何章节忘了进侧边栏，CI 直接拦下。
- **看得懂**：审计 68 篇成稿章的模板要素，58 → 62 篇齐全（补 `build/03` 记忆锚点、`F3/F4/F5` 缺失的 `## 记忆锚点` 标题、`gd32/01` 学习目标与「你做到了」）。余 6 项判定为规范允许的变体（环境章、对照章），未强改。
- **有兴趣**：`gd32/index.md` 补开场钩子，与各板块导览一致。
- **学得下去**：首页与 README 路线图终点曾画着「综合项目」而全站并无此板块——该断头路由综合项目任务收口（J1/J2）。

## 2026-10-07 · 知识覆盖审计与事实纠正

- 全站做了一次知识覆盖与教学完整性评估，列出 K1–K5 五类问题并逐项处理。
- **事实与行为纠正（K1–K4）**：TIM 输入捕获的回绕与测频模型；挂起调度不等于关中断临界区；IRAM 规则补上适用前提；OTA 回滚不是无条件默认行为——须 `CONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE`（默认未启用），成功确认 API 写全 `esp_ota_mark_app_valid_cancel_rollback`。
- **GD32 规划与统计口径（K5）**：此前统计的是「已建页面」而非「完整规划」，导览页规划 10 章却只建了 1 章。现已区分规划数/已建档数/成稿数，侧边栏全量补齐。
- **尚开着的坑**：先修区区分「必须掌握」与「可并行对照」的自动报告还在推进中。

## 2026-10-06 · 实验复现与质量检查

- E05 EEPROM、E07 六轴传感器、E08 音频放音补齐独立工程与源码；E02/E03 的命令、串口字符和默认 PWM 参数改为与工程一致。E04/E06 仍缺完整配套工程，改标建设中。
- 实验信息卡区分文稿、配套代码与上板验证，时长和难度从元数据读取；当前板上现象仍待实测。P12 区分有效 PCM 数据率与 I2S 双槽位时钟。
- FreeRTOS 不同场景使用独立构建目录；GD32 启动补 Thumb 复位标记和 FPU 初始化。GPIO Matrix 示例断开旧脚后再换脚，并取消向 PSRAM 占用脚输出。
- 发布必须通过同一提交的文档、固件与浏览器检查；工程清单和元数据严格校验。补 ld/gdb 高亮，搜索索引不重复收录完整源码，保留按需加载。

## 2026-10-06 · 动画补洞：机制图从"外围"补到"体内"

先盘家底：29 张动画里协议与外设时序占 9 张（`uart-frame`、`usart-txe-tc`、`i2c-timing`、`spi-timing`、`dma-circular-buffer`、`dma-pingpong`、`tim-pwm-counter`、`tim-input-capture`、`tcp-handshake`），MCU 与内核机制 8 张（`boot-sequence`、`irq-entry`、`context-switch`、`stack-frame`、`rcc-clock-tree`、`gd32-rcu-clock`、`gpio-config`、`gpio-matrix-routing`），RTOS/C 侧 12 张。**两个已"成稿"的硬核章节居然一张图都没有**——C1 讲一个变量在两地生活、B2 把同一个 ELF 翻两副目录，全靠读者自己在脑子里拼图。这一批把最该动的五处补上：

- **`bus-matrix.svg`（S1，720×470，5 阶段 / 15s）**：CPU 的 ICode/DCode/System 与 DMA 同挂一张 AHB 矩阵，五条路线逐个爬通——取指打到 Flash（168MHz 下 5 个等待周期，S2 已核过的数），读 `USART1->SR` 要穿 AHB→APB2 桥再同步，DMA 自己发地址但和 CPU 抢同一块 SRAM，最后一阶段故意走不通：**CCM RAM 只接到 CPU**，红线爬到 42% 就停、✕ 每秒闪一下——放错地方就是无声失败（[S8](../stm32/08-dma.md) 有对应翻车实验）。
- **`memory-two-homes.svg`（C1，720×452，5 阶段 / 15s）**：上电瞬间 RAM 里是随机值（虚线蚂蚁在爬）→ `Reset_Handler` 从 `_sidata=0x080002a0` 搬 12 字节到 `0x20000000`（曲线爬通 + `ldr/str/adds #4` 三圈）→ 绿光标扫过 `0x2000000c..0x2c` 清 `.bss` → 两支生长箭头立起 `_estack=0x20020000`，堆栈相向生长 → 反向路径只爬到 56% 就断，写明"永不回写"。**图里每个地址与字节数都是 `mem_probe.elf` 的实测值**，`sh probe.sh mem` 一条命令复现。
- **`elf-two-views.svg`（B2，720×458，4 阶段 / 12s）**：中间那条带子是文件里真实的字节顺序，上面挂节表、下面挂程序头，四阶段分别演示两套目录各连到文件哪一块、`Addr` 与 `Off` 差 `0x1000`、`NOBITS` 只登记不给货、第二条 LOAD 的 `FileSiz=0x0c` 与 `MemSiz=0x20` 之差正是 `.bss`，最后 `objcopy` 那一刀把符号表与调试信息整块擦掉（换 `blink.elf` 看：`34,604 − 660 = 33,944`）。
- **`bitband-alias.svg`（S1，720×452，5 阶段 / 15s）+ 新取证工程 `code/stm32/01-arch/`**：位带机制不再只有公式一行字——八条连线逐点把「一位 → 一个字」摊开，PF6 的别名地址按 `0x4200_0000 + 0x21414×32 + 6×4 = 0x4242_8298` 现场算出，源码里三条 `_Static_assert` 验算（编不过就是算错了）。左下与右下的反汇编是 xPack GCC 15.2.1 `-O2` 的真实输出：`GPIOF->ODR |= 1u<<6` 编成 `ldr / orr.w #64 / str` 三条，写别名字只剩 `movs r2,#1` + `str.w r2,[r3,#664]`（字面量 `0x4242_8000` 加 `0x298` 正是算出来的那个数）。`sh code/stm32/01-arch/probe.sh` 一条命令复现，不要开发板。
- **`sar-successive.svg`（S9，720×440，5 阶段 / 15s）+ 新取证工程 `code/stm32/09-adc/`**：逐次逼近不再只剩"像猜数字"这一句比喻——上面一格是采样保持给 `C_H` 充电定格，中间 12 个寄存器格子从 bit11 起逐个试 1，下面 DAC 把码值反喂、比较器只答大小：2048→1.6500 V 留、3072→2.4750 V 丢、2560→2.0625 V 丢，12 轮砍到 `1001 1011 0010` = 2482 = 0x9B2 → 1.9997 V，差 0.342 mV = 0.42 LSB；第 ⑤ 阶段把镜头拉回精度真正的天花板——高阻源没充满就转，红色充电曲线爬到半路就停。那 12 行试探表由 `sh code/stm32/09-adc/probe.sh sar` 现场算出（宿主 gcc，`-DVIN`/`-DVREF`/`-DBITS` 随便换：1.65 V 正落 0x800 误差 0.00 LSB，3.29 V 落 0xFF3 离满量程还差 12 个码，`-DBITS=8` 就只剩 8 轮）。**这是理想 ADC 的算法仿真，板上读数仍待接板实测**，`cross` 那一档只产 `.o`。
- **三道闸门 + 一道人眼闸门全绿**：`npm run anim:lint` 34/34 通过；`scripts/anim-audit.html` 逐阶段量"出界 / 压字"报 **34 张，有问题 0 处**；`npm run docs:build` 零死链（`ignoreDeadLinks: false` 仍开着）；`readme:check` 与 `links:check`（根文档 88 个链接）通过。五张新图在站点里被构建期内联成 `<AnimFigure>`，深色主题下底色实测 `rgb(30, 34, 42)`，无硬编码白块。
- 尚开着的坑（按缺口大小排）：MCU 体内机制还缺 **Flash 擦写与等待周期、低功耗进入/唤醒、HardFault 栈溢出现场、NVIC 尾链、PLL 模拟环路**；协议侧 CAN 帧与仲裁、Modbus RTU 的 T3.5、1-Wire、USB 枚举、I2S、MQTT/TLS **连章节都还没有**——图和文得一起补。位带翻 PF6 的板上现象、SAR 的真实读数（采样时间/源阻抗两栏实验）仍待接板回填。

## 2026-10-06 · 动画可执行化 + B2/C1 成稿

- **29 张教学动画全部过两道机器闸门**：`npm run anim:lint`（SMIL 槽位、色板映射、`dur` 整除、指示点越界）零告警；`scripts/anim-audit.html` 逐阶段量"出界 / 压字"零命中。规范落在 `.trellis/spec/docs-site/animation.md`。
- **`gd32-rcu-clock.svg` 从幻灯片改成动画**：原先只有四个阶段互相切换，现在每个阶段的时钟路由被逐点爬通（IRC16M→CK_AHB、HXTAL→PLL、电压档→PLL、PLL→三个分频口、CK_AHB→CK_OUT0→PA8），晶振与电压档盒子带节拍抖动，PLL 锁定后 APB1/APB2 各有一颗节拍常驻往返；两条脚注拆进 720 画布。
- **顺带揪出三处同排压字**：`context-switch`（`psp 存进 TCB_A` 与栈帧说明挤在同一行）、`uart-frame`（帧说明与位标注基线只差 8px）、`usart-txe-tc`（TXE 说明与反例文字重叠 34px）。只动坐标与锚点，配色与节拍未改。
- **B2 ELF 解剖成稿**：`readelf`/`objdump`/`nm` 五刀拆 `blink.elf` 与刻意留脏的 `elf_probe.elf`，34,604 字节 ELF 与 660 字节 bin、`.data` 的 `FileSiz=0x0c` 对 `MemSiz=0x20`、91 个中断弱别名、`readelf -s` 与 `nm` 的那个 ±1 全部是量出来的；取证工程 `code/toolchain/02-elf/probe.sh` 不要开发板也不要 make。
- **C1 内存模型成稿**：五段论 → 一个全局变量的三段旅程（源码 → ELF 双地址 → 上电搬运）→ `const` 经济学 → `nm`/map 审计，配套 `code/c/01-memory-model/probe.sh` 双工具链取证。
- **修掉 S2 工程里的一处真 bug**：`code/stm32/01-rcc-clock/main.c` 的 `mco1_init()` 把 `MCO1PRE` 按"分频比 − 1"编码，`/4` 写成 `0b011`——那一位落在**不分频**区，PA8 实际吐 168MHz，本章 42MHz 的对账本来不成立。改成显式映射表（/1 /2 /3 /4 /5 → 编码 0/4/5/6/7，依据 ST HAL `RCC_MCODIV_1..5`，`stm32f4xx_hal_rcc.h:314-318` @`1f6451c`）；默认与 `USE_HSE_PLL=1` 两档构建复编通过。同批把 G1 工程的 `clock_tree_readback()` 改成按 `SCSS` 如实解码时钟源、按 `RCU_PLL` 参数重算频率——回退路径不再由调用方传"自己以为的那一档"。
- 尚开着的坑：`00-blink` 六变体的板上现象、`CK_OUT0`/`MCO1` 的示波器实测值仍待接板回填。

## 2026-10-06 · 读者侧升级

- **章节元数据体系**：74 个章节页统一加 `status`（done/building）、`difficulty`（入门/进阶/硬核）、`minutes`（预计学习时长）三项 frontmatter；`scripts/gen-progress.mjs` 由此算出全站进度，取代原先散落在 README、首页与贡献指南里的手写数字（三处曾各说各话）。
- **首页学习地图**：新增 `LearningMap` 组件——按板块显示成稿进度条与章节胶囊，实心=成稿、虚线=建设中；顶部统计条一次给出成稿/实验/动画/工程与通读时长。
- **按身份分流**：首页新增五条上路方式（零基础 / 会 C 玩过 Arduino / 硬件出身 / 做 AIoT / 被 RTOS 卡住），替代原先按"最新成稿"排的表。
- **读者支撑页**：新增 [术语速查](/reference/glossary.md)（按板块分组的名词卡，每词条 = 一句话 + 常见误解 + 深读去处）、[FAQ](/reference/faq.md)、[关于我们与致谢](/reference/about.md)、本页。
- **站内搜索**：开启 VitePress 本地搜索，中文正文可直接搜寄存器名、引脚号与术语。

## 2026-10-06 · C3 volatile 成稿（含本站自我勘误）

- **C3 volatile 成稿**：as-if 授权书 → 四个现场取证 → 管/不管清单 → CMSIS `__IO` 与 SPL `__IO` 的对照读码 → `00-blink` 三处 volatile 逐行 → 临界区/屏障/cache 补边界；配套动画 `volatile-as-if.svg` 与零硬件取证工程 `code/c/03-volatile/`。
- **两套工具链取证**：宿主 gcc 16.1.0（x86-64）与 `arm-none-eabi-gcc 15.2.1`（`-mcpu=cortex-m4`）各跑一遍，四个现场的正反汇编全部进正文；`blink-variants.sh` 一次生成六个 `00-blink` 变体。
- **勘误一（本站写错）**：初版写"去掉 `delay` 参数的 `volatile`，`-O2` 灯就不闪"——实测不成立，循环体的 `__asm__ volatile ("nop")` 是另一道独立防线，必须连 `nop` 一起删才翻车。已改写正文与"常见坑"。
- **勘误二（新发现的实测事实）**：寄存器宏漏 `volatile` 的后果不是"写被折叠"，而是**顺序倒置**——`-O2` 下 `GPIOF_MODER` 的读被排到 `RCC_AHB1ENR` 的写之前；三处 volatile 全去时 `main` 直接塌成一条 `b.n 0`（所有外设写被当死 store 删除）。
- 尚开着的坑：`00-blink` 六变体的**板上肉眼现象与 PF6 波形**待接板回填（本轮只做到编译期）。

## 2026-10-06 · GD32 双系路线建档

- 官方一手源码入库（GD32F4xx 库 V3.3.3 `@10d02f4`、GD32VF103 `@7ab0521`、Bumblebee Core 手册）；
- **G1 RCU 时钟树成稿**：200MHz 是怎么算出来的，与 S2 逐字段对照，含 `CK_OUT0` 对账与"官方库空转轮询"的源码瑕疵记录；配套 `gd32-rcu-clock.svg` 动画与 `code/gd32/01-rcu-clock` 寄存器级工程。
- 尚开着的坑：FMC 等待周期"频率↔档位"对照表**待用户手册核验**；CK_OUT0 输出 50MHz **待上板实测**。

## 2026-10-06 · 三路线十章成稿

- STM32：S2 RCC 时钟树、S6 定时器 TIM、S7 USART、S8 DMA；
- FreeRTOS：F1 任务与 TCB、F6 通知/事件/软件定时器、F7 内存管理；
- ESP32-S3：P2 GPIO 矩阵、P5 UART 驱动、P7 定时器与 LEDC；
- 配套动画 14 张（新增 13 + 修订 DMA 乒乓）、工程 7 个（STM32 裸机 ×3、FreeRTOS 五场景、IDF ×3）。

## 2026-10-06 · 内核源码级四篇

- S11 I2C、F3 调度器、F4 队列、F5 信号量与互斥：全部以 SPL 与 FreeRTOS V11.1.0 原文行号引证；
- 新增 `priority-inversion`、`spi-timing` 动画与两支已验证的 B 站视频；
- 阅读体验：中文正文行距、品牌表头与斑马纹、【注】与答题卡样式、首页成稿引导带；favicon 修复 `/favicon.ico` 404。

## 2026-10-06 · 起点

- VitePress 站点与七板块深度大纲、双路线第 0 章（S0/P0）、实验中心模板与 E01–E03；
- S3 GPIO、B4 启动过程、F2 上下文切换成稿 + 8 张动画 + 视频嵌入组件；
- 接入 GitHub Pages（`base: /mcu/`），编辑链接与部署工作流上线。

## 下一步

按依赖顺序推进骨架章成稿：C 篇（地基，尤其 C2 指针与 C6 栈帧）→ B 篇剩余（B1/B3）→ S 篇中断与外设（S4 NVIC、S12 SPI、S16 HardFault）→ RT-Thread 全线。实验 E04–E08 的实测数据回填（电流、波形参数）与实物照片补齐同批进行。

想接手哪一篇，去 [仓库 Issue](https://github.com/zhuguang-ZFG/mcu/issues) 认领即可。
