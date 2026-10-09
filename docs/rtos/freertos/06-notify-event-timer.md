---
title: F6 任务通知、事件组与软件定时器
status: done
difficulty: 2
minutes: 40
---

# F6 任务通知、事件组与软件定时器

> 🎯 队列通用但有"运费"：建队列要 RAM、发送要拷贝。任务通知直接写进对方 TCB——零队列、零拷贝、一次写操作。一对一的通信场景，通知几乎总是更优解；但"更快"快多少取决于配置与场景，别背固定百分比。

## 本章精髓

1. **任务通知 = TCB 里的 32 位邮箱**：每个任务在 TCB 里有 `ulNotifiedValue[]`（值）+ `ucNotifyState[]`（状态）两个字段，槽位数由 `configTASK_NOTIFICATION_ARRAY_ENTRIES` 决定（本工程=1，所以"通知容量一"）。`xTaskNotifyGive` 走 eIncrement 累加，`xTaskNotify` 可覆盖/置位——**计数语义和覆盖语义是两条不同的路**。
2. **事件组 = 24 个标志位的"公告栏"**（TickType_t 32 位，扣掉 8 个控制位）：多任务按"任意/全部"条件等待一组位。**清位不是先唤醒者独占**：`xEventGroupSetBits` 把整个等待列表走一遍、满足条件的全部唤醒，最后按 `uxBitsToClear` **汇总一次清掉**（V11.1.0 `event_groups.c:547` 起）。
3. **软件定时器跑在"守护任务"里**：回调在守护任务上下文**串行**执行——一个回调磨蹭，排在后面的定时器全部晚一拍。所以回调里**禁止阻塞**，周期性小任务用它代替创建真任务。

## 怎么读这一章

- **能记住**：口诀"通知写 TCB 一步到位，事件组是位公告栏，软定时器住守护任务——回调里只办事，不等待。"
- **能理解**：为什么通知比队列快（无队列对象、无拷贝）；为什么"快 45%"不能当无条件结论；为什么事件组清位是汇总清而不是独占清。
- **能用**：用通知做一对一同步；用事件组做多条件汇合；用软件定时器做周期杂务。

## 学习目标

- 用任务通知改写"中断→任务"通信，说出 give/take 的计数语义与 notify 的覆盖语义的区别。
- 用事件组实现"双键齐备才解锁"，说清 ANY/ALL 与汇总清位。
- 创建一个周期软件定时器闪灯，并说明其回调上下文与禁忌。

## 先修

- [F1 任务与 TCB](01-task-tcb.md)、[F4 队列](04-queue.md)、[F5 信号量](05-sem-mutex.md)。

## 先跑起来（10 分钟 quick win）

`code/rtos/01-freertos-lab` 场景 2/3/4：

```bash
make DEMO_SCENE=2 flash    # 通知：took 的值就是"欠账总数"
make DEMO_SCENE=3 flash    # 事件组：ANY 先醒，ALL 等齐
make DEMO_SCENE=4 flash    # 定时器：slow cb 磨蹭时 fast cb 晚一拍
```

## 动画：三条路各一张

通知的两种语义（计数 vs 覆盖）、事件组的 ANY/ALL 与汇总清位、软件定时器的命令队列→守护任务→回调，各自一张图：

![任务通知动画](/anim/task-notification.svg)

![事件组等待动画](/anim/event-group-wait.svg)

![软件定时器动画](/anim/software-timer-service.svg)

## 版本与配置前提

- 内核：上游 **FreeRTOS-Kernel V11.1.0**。通知/事件组/定时器的 API 名与语义以 `include/task.h`、`event_groups.c`、`timers.c` 为准。
- 本工程 `FreeRTOSConfig.h`：`configTASK_NOTIFICATION_ARRAY_ENTRIES=1`、`configUSE_TIMERS=1`、`configTIMER_TASK_PRIORITY=4`（守护任务跑最高）、`configUSE_16_BIT_TICKS=0`（事件组 24 个可用位）。

## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| 一、通知原理 | TCB 两字段；give/take/notify 三组 API 的语义差 | 库解析 |
| 二、通知 vs 队列/信号量 | 快在哪里、为什么；选型表（一对一/多对一/多对多） | 配置 |
| 三、事件组 | 位语义/ANY/ALL/汇总清位 | 代码分析 |
| 四、软件定时器 | 守护任务模型；one-shot vs auto-reload | 配置 |
| 五、回调纪律 | 不能阻塞的原因推导；回调里该干什么 | 代码分析 |
| 六、代码分析 | 场景 2/3/4 的日志对照 | 代码分析 |

## 一、通知原理：TCB 里的 32 位邮箱

每个任务的 TCB 里有两组字段（数组长度 = `configTASK_NOTIFICATION_ARRAY_ENTRIES`）：

- `ulNotifiedValue[]`：32 位值；
- `ucNotifyState[]`：状态（未通知/已通知待取）。

三组 API（V11.1.0 `task.h` 宏 → `tasks.c` 实现）：

| API | 语义 | 落点 |
|---|---|---|
| `xTaskNotifyGive(x)` | 通知值 +1（eIncrement），**计数语义** | `task.h:2984` → `xTaskGenericNotify`（`tasks.c:7832`） |
| `xTaskNotify(x, v, eSetValueWithOverwrite)` | 直接覆盖，**覆盖语义** | `task.h:2611` |
| `ulTaskNotifyTake(pdTRUE, timeout)` | 阻塞到计数非零，取走时清零 | `task.h:3177` → `xTaskGenericNotifyWait`（`tasks.c:7717`） |

注意函数名：是 **`ulTaskNotifyTake`**（返回计数值），不是 `xTaskNotifyTake`——后者不存在。

## 二、通知 vs 队列/信号量：快在哪里

通知比队列快的原因很具体：**没有队列对象、没有拷贝、没有额外的链表项**——写一次 TCB 就完事。但"快多少"取决于你的配置（队列深度、是否从中断上下文、调度器当时的状态），官方文档里出现过"约 45%"的实测数字，那是**某个版本某个配置下**的结果，不是无条件结论。

选型表：

| 场景 | 选型 |
|---|---|
| 一对一、容量一、只要信号 | 通知（give/take） |
| 一对一、要带 32 位数据 | 通知（notify 覆盖语义） |
| 多对一 / 一对多 | 队列 |
| 多对多、要带任意长数据 | 队列 |
| 要等"几个条件都齐" | 事件组 |

## 三、事件组：ANY/ALL 与汇总清位

`xEventGroupWaitBits(组, 位掩码, xClearOnExit, xWaitForAllBits, timeout)`：

- `xWaitForAllBits=pdFALSE` → **ANY**：任一位满足就醒；
- `xWaitForAllBits=pdTRUE` → **ALL**：所有位都满足才醒。

**清位的真相**（V11.1.0 `event_groups.c` `xEventGroupSetBits`）：`SetBits` 会把整个等待列表**完整走一遍**，每个满足条件的任务都被唤醒；每个带 `xClearOnExit` 的等待者把它等的位并进 `uxBitsToClear`，**列表走完后统一清一次**（`pxEventBits->uxEventBits &= ~uxBitsToClear`）。

所以"第一个等到的人把位清掉、后来者永远等不到"是错的——**同一次 SetBits 里所有满足条件的等待者都能醒**，清位发生在所有人都看完之后。真正的坑在另一边：如果你想让"下一批人"也看到这些位，就别开 `xClearOnExit`。

## 四、软件定时器：守护任务模型

`xTimerCreate(名字, 周期, autoReload, id, 回调)` 创建的定时器**不是**一个独立的执行上下文。所有定时器的回调都跑在同一个**守护任务**里（`timers.c` 的 `prvTimerTask`）：

```
你的代码 xTimerStart() → 命令进 xTimerQueue → 守护任务取出执行回调
```

守护任务的优先级由 `configTIMER_TASK_PRIORITY` 决定（本工程=4，最高）。回调之间是**串行**的：前一个回调磨蹭 50ms，排在后面的定时器就晚 50ms——这是模型，不是 bug。

one-shot vs auto-reload：`autoReload=pdTRUE` 周期触发，`pdFALSE` 触发一次就停。

## 五、回调纪律：为什么禁止阻塞

回调跑在守护任务里，守护任务是"所有定时器共用的执行线程"。你在回调里 `vTaskDelay`，守护任务阻塞，**所有**定时器停摆。所以回调里：

- **可以**：置标志、发通知、写队列（不带阻塞的版本）、改 GPIO；
- **不可以**：`vTaskDelay`、等队列满/空（带 timeout）、等信号量。

想让定时器"每 100ms 闪一下灯"：回调里只翻 GPIO，别在回调里睡。

## 六、代码分析：场景 2/3/4 日志对照

- **场景 2（通知）**：生产端每 50ms give 一次，消费端 `ulTaskNotifyTake` 取走。把生产 delay 改小，`took` 的值就会变成 >1——计数语义把"欠的账"攒着；如果改成覆盖语义，多出来的就丢了。
- **场景 3（事件组）**：只发 bit0 时只有 `ANY woke`；bit0+bit1 都置上后 `ALL woke` 才出现，而且**两个等待者同时醒**——汇总清位的直接证据。
- **场景 4（定时器）**：`slow cb` 每次磨蹭 ~50ms，你会看到紧跟其后的 `fast cb` 晚一拍——守护任务串行执行回调的直接证据。

## 七、选型决策树：通知 / 队列 / 事件组

拿到一个"任务间通信"需求，按这个顺序问：

```
1. 是"一对一"还是"多对多"？
   ├─ 一对一 → 继续问 2
   └─ 多对多 → 队列（带数据）/ 事件组（只带信号）

2. 需要传数据还是只传信号？
   ├─ 只传信号 → 继续问 3
   └─ 要传数据 → 队列（数据 > 32 位）/ 通知（数据 ≤ 32 位，覆盖语义）

3. 需要攒"欠账"还是只关心最新值？
   ├─ 攒欠账 → xTaskNotifyGive（计数语义）
   └─ 只关心最新 → xTaskNotify（覆盖语义）

4. 需要等"几个条件都齐"？
   └─ 是 → 事件组（ANY/ALL）
```

**经验法则**：中断 → 单任务同步，默认用通知；任务 → 任务传数据，默认用队列；多条件汇合（如"初始化完成 + 传感器就绪 + 网络连上"），用事件组。

## 八、软件定时器 vs 任务内 vTaskDelay

两者都能做周期任务，选型看三点：

| 维度 | 软件定时器 | 任务 + vTaskDelay |
|---|---|---|
| RAM 开销 | 零（共用守护任务） | 一个任务的栈 + TCB |
| 回调里能阻塞吗 | **不能**（堵守护任务） | 能（只堵自己） |
| 时间精度 | 受守护任务队列负载影响 | 只受调度器影响 |
| 适合 | 周期杂务（LED 闪、看门狗喂） | 需要独立逻辑、可能阻塞的任务 |

**反模式**：在软件定时器回调里做 I2C 读取——I2C 超时阻塞会拖垮所有定时器。正确做法是回调里发通知，由专门的任务做 I2C。

## 九、GDB 调试通知与事件组

通知和事件组的状态都在 TCB 里，GDB 可以直接看：

```bash
# 查看任务的通知值（计数语义）
(gdb) p pxCurrentTCB->ulNotifiedValue[0]
$1 = 3    # 欠了 3 次没取

# 查看通知状态
(gdb) p pxCurrentTCB->ucNotifyState[0]
$2 = 1 '\001'    # 1 = 已通知待取

# 查看事件组位
(gdb) p xEventGroup->uxEventBits
$3 = 5    # bit0 + bit2 置位

# 在通知到达时打断点
(gdb) break xTaskNotifyGive
(gdb) commands 1
> p xTaskToNotify->pcTaskName
> continue
> end
```

**调试纪律**：通知是"瞬时状态"——GDB 暂停时看到的值可能已经被消费。用 `watch` 命令抓变化比 `break` 更精准：

```bash
# 通知值变化时自动暂停
(gdb) watch pxCurrentTCB->ulNotifiedValue[0]
```

## 附录：工程完整源码

<<< ../../../code/rtos/01-freertos-lab/main.c

## 记忆锚点

::: tip 一句话记住
**通知写 TCB 一步到位，事件组是位公告栏，软定时器住守护任务——回调里只办事，不等待；清位是汇总清，不是先醒者独占。**
:::

**延伸**：硬件 TIM（[S6](../../stm32/06-tim.md)）管外设时基，软件定时器管周期任务——分工不同；任务通知可替代队列用于 1:1 数据传递（[F4](04-queue.md)），更轻量。

## 实物实验

- 场景 2：把生产端 delay 从 50ms 改到 10ms，看 `took` 的值涨上去；
- 场景 3：给 ANY 等待者加 `xClearOnExit=pdFALSE`，再发一次 bit0——这次 ALL 也能等到；
- 场景 4：把 `slow cb` 的磨蹭时间改到 200ms，数 `fast cb` 丢了几拍。

## 常见坑

- **通知当通用队列用**：槽位数 = `configTASK_NOTIFICATION_ARRAY_ENTRIES`（本工程=1）——多对多还是队列；
- **记错函数名**：是 `ulTaskNotifyTake`，不是 `xTaskNotifyTake`；
- **覆盖丢事件**：高频通知未消费就被覆盖——要攒"欠账"用 `xTaskNotifyGive`（eIncrement）；
- **事件组 xClearOnExit 误用**：想让"下一批"也看到这些位就别开自动清；
- **软定时器回调里 vTaskDelay**：守护任务一堵，所有定时器集体迟到。

## 短自测

1. 任务通知的"计数语义"和"覆盖语义"分别对应哪个 API？
<details><summary>参考答案</summary>计数语义是 xTaskNotifyGive（eIncrement，通知值 +1）；覆盖语义是 xTaskNotify 的 eSetValueWithOverwrite（直接盖掉旧值）。欠账要攒就用前者，只关心最新值就用后者。</details>

2. 事件组里两个任务都在等同一组位，一个等 ANY、一个等 ALL，发 SetBits 把位全置上后，谁会醒？位什么时候清？
<details><summary>参考答案</summary>两个都醒。SetBits 把整个等待列表走完、所有满足条件的都唤醒，然后按 uxBitsToClear 汇总清一次（event_groups.c:547 起）。不存在"先醒者独占"。</details>

3. 软件定时器的回调里为什么不能 vTaskDelay？
<details><summary>参考答案</summary>回调跑在守护任务里，守护任务是所有定时器共用的执行线程。回调阻塞 = 守护任务阻塞 = 所有定时器集体停摆。回调必须快进快出。</details>

4. 为什么"通知比队列快 45%"不能当无条件结论引用？
<details><summary>参考答案</summary>那是官方文档在某个版本、某个配置下的实测数字。通知快的根源是无队列对象、无拷贝、无额外链表项；具体快多少取决于你的队列深度、是否从中断上下文、调度器当时的状态。引用时必须带版本与配置条件。</details>

## 对照表：本章概念 → 仓库与上游落点

| 概念 | 落点 |
|---|---|
| give/take/notify API | 上游 V11.1.0 `task.h:2984/3177/2611` → `tasks.c:7832/7717` |
| 事件组汇总清位 | 上游 V11.1.0 `event_groups.c:547`（xEventGroupSetBits） |
| 守护任务 | 上游 V11.1.0 `timers.c`（prvTimerTask） |
| 场景实验 | [code/rtos/01-freertos-lab](https://github.com/zhuguang-ZFG/mcu/tree/main/code/rtos/01-freertos-lab) 场景 2/3/4 |
| 动画 | [task-notification.svg](/anim/task-notification.svg)、[event-group-wait.svg](/anim/event-group-wait.svg)、[software-timer-service.svg](/anim/software-timer-service.svg) |

## 你做到了

- 通信工具箱从"队列打天下"升级为按场景选型；
- 事件组的"汇总清位"不再是玄学；
- 软定时器接管周期性杂务，任务数开始下降。

<div class="achievement">
✅ 下一站：<a href="07-heap.html">F7 内存管理</a>——heap_1~heap_5 五种人生，栈水位与堆碎片实测。
</div>