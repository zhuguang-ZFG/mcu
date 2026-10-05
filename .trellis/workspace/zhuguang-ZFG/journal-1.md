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

