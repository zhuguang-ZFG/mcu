---
title: P4 中断与双核：IRAM 纪律与核间分工
status: done
difficulty: 3
minutes: 40
---

# P4 中断与双核：Cache 关了，你的 ISR 还能跑吗

> 🎯 ESP32 最著名的事故现场：代码在 Flash 里，系统在写 Flash（NVS/OTA 常干）——Cache 一关，取指无门，中断来了直接崩。所以有了铁律：**声明 `ESP_INTR_FLAG_IRAM` 的中断必须保证可达代码/数据均在内部存储；普通非 IRAM-safe 中断在 Flash 操作期间会被推迟**。

## 本章精髓

1. `IRAM_ATTR` 是生存问题不是性能问题：Cache 关闭窗口内，只有 IRAM/ROM 里的代码可取指——ISR 本体、它调用的函数、用到的 rodata 全要排查（`esp_intr_alloc` 的 `ESP_INTR_FLAG_IRAM` 标志强制约束）。
2. 中断分配器是"总机"：S3 有 **99 个中断源**（实测），经中断矩阵分配到两个核的 **7 级**中断——`esp_intr_alloc` 把外设源、优先级、所属核绑在一起。
3. 双核 SMP 的共享规矩：FreeRTOS 在 S3 上是 SMP 单实例（任务可跑任意核，也可 `xTaskCreatePinnedToCore` 钉核）——核间共享数据用自旋锁/`portMUX`，**中断与任务、核与核之间 `volatile` 完全不够**（回 [C3](../c/03-volatile.md) 的边界清单）。

## 怎么读这一章

- **能记住**：一句话——**Flash 里的代码在 Cache 关闭时等于不存在；ISR 要么搬进 IRAM，要么接受被推迟。**
- **能理解**：`IRAM_ATTR` 只是往链接器段里一塞（`".iram1"`），真正保证"能在关 Cache 时跑"的是**整条调用链**都在 IRAM——包括它读的常量。
- **能用**：给一个外设挂中断时，能正确选 `ESP_INTR_FLAG_LEVELx` 与 `ESP_INTR_FLAG_IRAM`，并知道什么时候必须用 `portMUX` 而不是 `volatile`。

## 学习目标

- 说清 Cache 禁用窗口下"代码必须可达"的约束，并指出 `IRAM_ATTR` 与 `ESP_INTR_FLAG_IRAM` 在源码里的定义位置。
- 能解释 `esp_intr_alloc` 的五个参数，特别是 `source`（中断源）与 `flags`（优先级/IRAM/边沿）如何决定绑到哪个核。
- 能在双核场景下给出正确的共享数据方案：`portMUX_TYPE` 自旋锁 / 队列 / 任务通知，并说清为什么 `volatile` 不够。
- 与 [S4 NVIC](../stm32/04-nvic-exti.md) 对照，说清单核 NVIC 与 ESP32 中断矩阵的差异。

## 先修

- [P1 S3 架构与启动](01-arch-boot.md)：双核、IRAM/DRAM、Cache 映射执行——本章的铁律全是它的推论。
- [C3 volatile](../c/03-volatile.md)：`volatile` 能做什么、不能做什么——本章直接引用其边界清单。
- [S4 中断与 NVIC](../stm32/04-nvic-exti.md)：优先级、向量表、ISR 礼仪——单核侧的对照系。

## 先跑起来（10 分钟 quick win）

在 `code/esp32/01-gpio-matrix` 里给一个 GPIO 挂中断，对比两种写法：

```c
/* 写法 A：普通 ISR —— 代码在 Flash 里 */
static void IRAM_ATTR my_isr(void *arg)   /* 先看 B，再把这个 IRAM_ATTR 删掉体会差别 */
{
    BaseType_t hp = pdFALSE;
    xQueueSendFromISR(evt_queue, &tick, &hp);
    portYIELD_FROM_ISR(hp);
}

/* 挂中断：指定优先级 + 是否 IRAM-safe */
esp_intr_alloc(ETS_GPIO_INTR_SOURCE, ESP_INTR_FLAG_LEVEL1 | ESP_INTR_FLAG_IRAM,
               my_isr, NULL, NULL);
```

编译并查看 `my_isr` 落在哪个段（**待上机回填**）：

```bash
idf.py build
arm-none-eabi-nm build/*.elf | grep -i my_isr     # 看地址落在 0x400xxxxx(IRAM) 还是 0x42xxxxxx(Flash)
```

**判据**：带 `IRAM_ATTR` 时应落在 IRAM 地址段（`0x40000000` 起），不带则落在 Flash 映射段（`0x42xxxxxx` 或 `0x3Cxxxxxx` 区）。这是本章所有纪律的物理基础。

## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| Cache 与取指 | Flash 映射执行；为什么关 Cache 会"代码消失" | 配置 |
| IRAM 纪律 | `IRAM_ATTR` 的定义；整条调用链与 rodata 的连带责任 | 库解析 |
| 中断分配器 | 99 个源 × 7 级 × 2 核；`esp_intr_alloc` 五参数 | 库解析 |
| 双核分工 | SMP vs 钉核；`xTaskCreatePinnedToCore` 的核参数 | 代码分析 |
| 共享数据规矩 | `portMUX` 自旋锁、队列、通知；`volatile` 的边界 | 配置 |
| 与 NVIC 对照 | 单核向量表 vs 中断矩阵 + 分核 | 配置 |

## 一、Cache 与取指：为什么"代码会消失"

先看这张图：取指的两条路，和 Cache 关闭窗口里一个中断的两种命运。

![IRAM 纪律与 Cache 关闭窗口动画](/anim/iram-discipline.svg)

[P1](01-arch-boot.md) 讲过内存分级，这里把它推到结论。ESP32-S3 上你的应用代码**绝大多数放在外部 Flash 里**，通过 **Cache 映射窗口**执行。这意味着"执行一条 Flash 里的指令"实际上是：

```text
CPU 取指 → Cache 命中？ → 命中：直接返回指令
                        → 未命中：去 Flash 读（慢，但能读）
```

**关键在"Cache 关闭"这个状态**。系统在做这些事时会**暂时禁用 Cache**：

- 写 Flash（NVS 提交、OTA、`esp_partition_write`）；
- 某些低层 Flash 操作与加密操作。

**Cache 一关，映射窗口失效**——此时 CPU 若要从 Flash 取指，**没有任何路径能拿到那条指令**。硬件层面的结果就是异常/崩溃。

**所以问题不是"会不会遇到"，而是"你的哪个 ISR 会在那个窗口里被触发"。** 中断是**异步**的：NVS 正在写 Flash，恰好你的 GPIO 中断来了——如果你在 `esp_intr_alloc` 时**没有**声明 IRAM-safe，系统会让这个中断**推迟**到 Cache 恢复；如果声明了却**没做到**整条链在 IRAM，就是直接崩。

## 二、IRAM 纪律：`IRAM_ATTR` 只是入场券

**定义**（`components/esp_common/include/esp_attr.h:23`）：

```c
#define IRAM_ATTR _SECTION_ATTR_IMPL(".iram1", __COUNTER__)
```

就这么简单——`IRAM_ATTR` 干的事是**把这段代码放进名为 `.iram1` 的链接段**，由链接脚本安排到内部 SRAM（可执行区）。它不是"加速"，是"改变落址"。

**但把它加在 ISR 函数上只是第一步**。真正的约束是**整条执行链**都要可达：

| 要排查的东西 | 为什么 |
|---|---|
| ISR 本体 | 显然——它自己要取指 |
| ISR 调用的**所有**函数 | 调用即取指；内联的不算问题，没内联的就是问题 |
| ISR 用到的 **rodata**（字符串常量、查表、`const` 数组） | 数据默认在 Flash 映射区，关 Cache 时读不到 |

**实践清单**（写 IRAM-safe ISR 时逐条过）：

1. ISR 本体标 `IRAM_ATTR`；
2. 它调用的每个非内联函数也标 `IRAM_ATTR`（编译器若内联则免除，但**不要依赖内联**）；
3. 所有 `const` 查表/字符串也标 `IRAM_ATTR`（或放进 DRAM）；
4. **不要**在里面调 `printf`、`malloc`、任何可能碰 Flash 的 API；
5. 需要跨 ISR/任务传数据 → 用 `...FromISR` API（它们本身就是 IRAM-safe 的）。

**`ESP_INTR_FLAG_IRAM` 是声明侧的开关**（`components/esp_hw_support/include/esp_intr_alloc.h:42`）：

```c
#define ESP_INTR_FLAG_IRAM          (1<<10) ///< ISR can be called if cache is disabled
```

它的语义是**承诺**：我保证这个 ISR 在 Cache 关闭时也能跑。系统的回应是：**那就不推迟它**——Cache 关着也照样调用。所以：

- **不标 `ESP_INTR_FLAG_IRAM`**：系统会在 Flash 操作期间**推迟**该中断（安全，但有延迟）；
- **标了 `ESP_INTR_FLAG_IRAM`**：系统不推迟（低延迟），但**你承诺的必须是真的**——链条上任何一环在 Flash 里，就是崩。

> 这是本章最值得记住的**权责对等**：低延迟不是免费的，你用自己的正确性给它做担保。

## 三、中断分配器："总机"上的 99 条线

STM32 上中断和向量是**一一对应**的（[S4](../stm32/04-nvic-exti.md)：`EXTI0_IRQn = 6` → 固定向量槽）。ESP32-S3 是**中断矩阵**：外设的中断源可以**路由**到某个核的某个中断级。

**规模**（实测 `components/soc/esp32s3/include/soc/interrupts.h`）：

- 中断源枚举从 `ETS_WIFI_MAC_INTR_SOURCE = 0`（第 18 行）一直排到 `ETS_PERI_BACKUP_INTR_SOURCE`（第 116 行），随后是 `ETS_MAX_INTR_SOURCE`（第 118 行，注释写着 "number of interrupt sources"）。
- **实际数量 = 99 个中断源。**

**中断级**（`components/esp_hw_support/include/esp_intr_alloc.h:33-43`）：

| 标志 | 值 | 含义 |
|---|---|---|
| `ESP_INTR_FLAG_LEVEL1` | `1<<1` | 最低优先级的中断向量 |
| `ESP_INTR_FLAG_LEVEL2` … `LEVEL6` | `1<<2` … `1<<6` | 逐级升高 |
| `ESP_INTR_FLAG_NMI` | `1<<7` | 最高优先级（不可屏蔽） |
| `ESP_INTR_FLAG_SHARED` | `1<<8` | 允许 ISR 共享 |
| `ESP_INTR_FLAG_EDGE` | `1<<9` | 边沿触发 |
| `ESP_INTR_FLAG_IRAM` | `1<<10` | 关 Cache 时也能调用（第二节） |
| `ESP_INTR_FLAG_INTRDISABLED` | `1<<11` | 分配后先禁用 |

源文件第 31 行还有一条**给实现者的提醒**：`Keep the LEVELx values as they are here; they match up with (1<<level)`——即**位号就是级别号**，这不是巧合，是接口约定。

**分配函数**（同文件 `:149`）：

```c
esp_err_t esp_intr_alloc(int source, int flags, intr_handler_t handler, void *arg, intr_handle_t *ret_handle);
```

五个参数各自的角色：

| 参数 | 填什么 | 从哪来 |
|---|---|---|
| `source` | 中断源（如 `ETS_GPIO_INTR_SOURCE`） | `soc/esp32s3/include/soc/interrupts.h` 的枚举 |
| `flags` | 级别 + 特性（OR 起来） | 上面那张表 |
| `handler` | 你的 ISR 函数 | 你写的 |
| `arg` | 传给 ISR 的参数 | 你定的（常用于传句柄） |
| `ret_handle` | 返回句柄，用于后续 `esp_intr_free` | 可以传 `NULL` |

**绑到哪个核**由 `flags` 里的级别与源决定（见 `esp_intr_alloc` 文档头里对 level 的说明）；简单记法是：**级别越高越"紧急"，也越不能用普通 API**。

## 四、双核分工：SMP 与钉核

S3 是双核（`SOC_CPU_CORES_NUM = 2`，[P1](01-arch-boot.md) 已引）。FreeRTOS 在 S3 上跑 **SMP**：默认情况下任务可以调度到任意核。

**需要控制时用钉核版 API**（`components/freertos/FreeRTOS-Kernel/include/freertos/task.h:382-389`）：

```c
extern BaseType_t xTaskCreatePinnedToCore( TaskFunction_t pxTaskCode,
                                           const char * const pcName,
                                           const configSTACK_DEPTH_TYPE usStackDepth,
                                           void * const pvParameters,
                                           UBaseType_t uxPriority,
                                           TaskHandle_t * const pvCreatedTask,
                                           const BaseType_t xCoreID );
```

比 `xTaskCreate` 多最后一个参数 `xCoreID`：

- `0` / `1`：钉到 PRO_CPU / APP_CPU；
- `tskNO_AFFINITY`：不钉核（调度器自由安排）。

函数注释紧接着写明了这一点（`:394`）：**"Call the 'PinnedToCore' version with `tskNO_AFFINITY` to create an unpinned task."**——所以 `xTaskCreate` 本质上就是 `xTaskCreatePinnedToCore(..., tskNO_AFFINITY)` 的包装。

**什么时候该钉核**：

- 任务与**核绑定的外设**强相关（某些外设的中断固定在某核）；
- 需要**核间负载**明确分工（一核专管通信、一核专管控制）；
- 排查"任务跑到哪个核"引起的问题时先钉住复现。

反过来说，**能不钉就不钉**——钉核会降低调度器的灵活性，也让负载均衡失效。

## 五、共享数据：`volatile` 不够，要用自旋锁

这是 [C3 volatile 边界清单](../c/03-volatile.md) 的直接延续。在双核 + 中断的 ESP32 上，`volatile` **保证不了**任何一件事：

| 需求 | `volatile` 能做吗 | 正确做法 |
|---|---|---|
| 阻止编译器优化掉访问 | ✅ 能 | `volatile` 本行 |
| 读-改-写不被打断 | ❌ 不能 | `portMUX` 自旋锁 / 临界区 |
| 核与核之间的可见性 | ❌ 不能 | 自旋锁 / 原子操作 / 队列 |
| ISR 与任务之间传数据 | ❌ 不能 | `...FromISR` API（队列/通知） |

**`portMUX_TYPE` 的实现**（`components/freertos/FreeRTOS-Kernel/portable/xtensa/include/freertos/portmacro.h:188`）：

```c
typedef spinlock_t                          portMUX_TYPE;               /**< Spinlock type used by FreeRTOS critical sections */
#define portMUX_INITIALIZER_UNLOCKED        SPINLOCK_INITIALIZER        /**< Spinlock initializer */
```

而 `spinlock_t` 本体定义在 `components/esp_hw_support/include/spinlock.h:45`。

**三种场景的正确选择**：

```c
/* 场景 1：任务里保护共享变量的读-改-写（可能被其它核或 ISR 打断） */
static portMUX_TYPE my_mux = portMUX_INITIALIZER_UNLOCKED;

portENTER_CRITICAL(&my_mux);
shared_counter++;
portEXIT_CRITICAL(&my_mux);

/* 场景 2：ISR → 任务 传数据（唯一推荐的做法） */
xQueueSendFromISR(q, &data, &hp);      /* ISR 里 */
xQueueReceive(q, &data, portMAX_DELAY); /* 任务里 */

/* 场景 3：任务 → 任务 或 核 → 核 传数据 */
xQueueSend(...) / xTaskNotifyGive(...)  /* 用内核对象，别自己造轮子 */
```

**为什么临界区只包"读-改-写"而不是整个函数**：`portENTER_CRITICAL` 在有自旋锁的平台上会**关中断**（或自旋），持锁时间越长，实时性越差。**临界区要尽可能短**——这是 [F0](../rtos/freertos/00-why-rtos.md) 那个"任务越少越优雅"的同一条原则在锁上的体现。

## 六、与 NVIC 对照：单核与中断矩阵

| | STM32 F407（[S4](../stm32/04-nvic-exti.md)） | ESP32-S3 |
|---|---|---|
| 中断控制 | NVIC（每核一个，F407 单核） | **中断矩阵**（源 → 核 → 级） |
| 中断源数 | 按外设固定（IRQn 枚举） | **99 个源**（实测），可路由 |
| 优先级 | 4 位，`IP 字节 = 逻辑优先级 << 4` | **7 级**（`ESP_INTR_FLAG_LEVEL1..6` + NMI） |
| 向量表 | 固定地址数组，`IRQn + 16` | 由分配器动态绑定 |
| ISR 落址 | Flash 原地执行，无所谓 | **Flash 经 Cache 映射**——关 Cache 时不可取指 → IRAM 纪律 |
| 分配方式 | `NVIC_EnableIRQ(IRQn)` | `esp_intr_alloc(source, flags, ...)` |
| 核间 | 不存在 | 自旋锁 / `portMUX` / 队列 |

**一句话概括差异**：STM32 的中断是**静态的**（谁挂哪个向量、什么优先级，编译期定死）；ESP32 的中断是**动态分配的**（运行时把源路由到核与级）。动态化换来灵活性，代价就是你多了一份责任：**分配时声明的一切，运行时要真做到**——IRAM 承诺如此，优先级选择亦然。

## 附录：工程完整源码

**01-gpio-matrix 的 main**（本章实验的起点：一个真实外设工程，`app_main` → 外设初始化；「先跑起来」的 ISR 就挂在它的 GPIO 上）：

<<< ../../code/esp32/01-gpio-matrix/main/main.c

**它的组件声明**（`REQUIRES esp_driver_ledc esp_driver_gpio` —— P3 讲过的依赖声明，中断 API 就来自其中的驱动组件）：

<<< ../../code/esp32/01-gpio-matrix/main/CMakeLists.txt

## 记忆锚点

::: tip 一句话记住
**Cache 一关 Flash 里没代码：ISR 要么进 IRAM（还要带上它调的函数和常量），要么老实被推迟；双核共享别信 volatile，上 portMUX。**
:::

## 实物实验

- 写一个带 `IRAM_ATTR` 的 ISR 和一个不带的，`idf.py build` 后用 `arm-none-eabi-nm` 对比符号地址落在 IRAM（`0x400xxxxx`）还是 Flash 映射段——把两个地址记进实验记录（**待上机回填**）。
- 给一个 GPIO 中断同时挂 `ESP_INTR_FLAG_LEVEL1` 与 `ESP_INTR_FLAG_IRAM`，在 ISR 里**故意**调 `printf`——观察它在 Flash 操作期间是否崩溃（**这是反例实验，小心使用**；**待上机回填**）。
- 用 `xTaskCreatePinnedToCore(..., xCoreID)` 分别传 `0`、`1`、`tskNO_AFFINITY` 创建同一个任务，在任务里打印 `xPortGetCoreID()`——记录三种情况下任务实际落在哪个核（**待上机回填**）。
- 把 `ESP_INTR_FLAG_LEVEL1` 改成 `LEVEL3`，观察中断响应行为（**待上机回填**）。

## 常见坑

- **只给 ISR 本体标 `IRAM_ATTR`**：它调用的函数、它读的字符串还在 Flash 里——关 Cache 时照样崩。**整条链**都要排查。
- **声明了 `ESP_INTR_FLAG_IRAM` 却没做到**：这比不声明更糟——不声明只是被推迟（安全），声明了却是**直接崩**。
- **ISR 里调 `printf`/`malloc`**：既可能碰 Flash，又可能违反 ISR 礼仪（[S4](../stm32/04-nvic-exti.md) 的"中断里只做快递分拣"）。用 `...FromISR` API 或只置标志。
- **用 `volatile` 代替锁**：在双核 + 中断面前，`volatile` 既保证不了原子性也保证不了可见性。核间共享必须上 `portMUX` 或内核对象。
- **无脑钉核**：`xTaskCreatePinnedToCore` 用得越多，调度器越没得选，负载均衡失效。只在**有理由**时钉。
- **中断级越高越好**：级别高意味着它可能**抢占内核自己的临界区**，而高优先级 ISR **不能**调用大部分内核 API。默认从 `LEVEL1` 起步，确有需要再升。

## 短自测

**1. 为什么"代码在 Flash 里"这条在 STM32 上无所谓，在 ESP32 上是生死问题？**

<details>
<summary>看答案</summary>

STM32 的 Flash 是**原地执行**的（地址空间直接映射，CPU 直接从 Flash 取指，没有中间层）。ESP32-S3 的代码在外部 Flash，通过 **Cache 映射窗口**执行——系统写 Flash 时会**暂时禁用 Cache**，此时映射窗口失效，CPU 从 Flash **取不到指令**。所以 ISR 若在 Flash 里，关 Cache 期间被触发就是崩溃（除非没声明 IRAM-safe，被推迟）。

</details>

**2. `IRAM_ATTR` 到底做了什么？加在 ISR 上够吗？**

<details>
<summary>看答案</summary>

它把代码放进 `.iram1` 段（`components/esp_common/include/esp_attr.h:23`：`#define IRAM_ATTR _SECTION_ATTR_IMPL(".iram1", __COUNTER__)`），由链接脚本安排到内部 SRAM。**加在 ISR 本体上不够**：ISR 调用的所有非内联函数、以及它读的所有 rodata（字符串、`const` 查表）也必须在 IRAM，否则整条链上有一环在 Flash 就崩。

</details>

**3. 不声明 `ESP_INTR_FLAG_IRAM` 会怎样？**

<details>
<summary>看答案</summary>

系统会在 Flash 操作（Cache 禁用）期间**推迟**这个中断——ISR 不会被调用，等到 Cache 恢复再执行。这是**安全但可能有延迟**的行为。相反，声明了 `ESP_INTR_FLAG_IRAM` 就是承诺"我能在关 Cache 时跑"，系统不再推迟，代价是你必须真的保证整条链可达。

</details>

**4. S3 有多少个中断源？几个中断级？**

<details>
<summary>看答案</summary>

**99 个中断源**——实测 `components/soc/esp32s3/include/soc/interrupts.h`：从 `ETS_WIFI_MAC_INTR_SOURCE = 0`（第 18 行）到 `ETS_PERI_BACKUP_INTR_SOURCE`（第 116 行）共 99 项，紧跟着 `ETS_MAX_INTR_SOURCE`（第 118 行，注释 "number of interrupt sources"）。
**7 个级别**——`ESP_INTR_FLAG_LEVEL1..LEVEL6`（`1<<1`..`1<<6`）加 `ESP_INTR_FLAG_NMI`（`1<<7`），见 `components/esp_hw_support/include/esp_intr_alloc.h:33-39`。

</details>

**5. 双核之间共享一个计数器，为什么 `volatile int n; n++;` 是错的？**

<details>
<summary>看答案</summary>

两个原因：**① 非原子**——`n++` 是"读-改-写"三步，另一个核或 ISR 可能插在中间，导致丢失更新；**② 无可见性/顺序保证**——`volatile` 只阻止编译器优化掉这次访问，不提供跨核的同步语义。正确做法是 `portENTER_CRITICAL(&mux)` 包住读-改-写（`portMUX_TYPE` 是自旋锁，`portmacro.h:188`），或干脆用内核对象（队列、通知）代替裸变量。

</details>

## 对照表：本章概念 → 仓库落点

| 概念 | 仓库落点 |
|---|---|
| `IRAM_ATTR` 定义（放进 `.iram1` 段） | `$IDF_PATH/components/esp_common/include/esp_attr.h:23` |
| `ESP_INTR_FLAG_IRAM`（`1<<10`，关 Cache 可调用） | `$IDF_PATH/components/esp_hw_support/include/esp_intr_alloc.h:42` |
| 中断级别标志 `LEVEL1..6` / `NMI` | 同上 `:33-39` |
| 其余特性标志（SHARED/EDGE/INTRDISABLED） | 同上 `:40-43` |
| 中断源数量（99）与枚举 | `$IDF_PATH/components/soc/esp32s3/include/soc/interrupts.h:18-118` |
| `esp_intr_alloc` 五参数签名 | `$IDF_PATH/components/esp_hw_support/include/esp_intr_alloc.h:149` |
| `xTaskCreatePinnedToCore` 七个参数 | `$IDF_PATH/components/freertos/FreeRTOS-Kernel/include/freertos/task.h:382-389` |
| 不钉核 = 传 `tskNO_AFFINITY` | 同上 `:394` 附近注释 |
| `portMUX_TYPE` 是自旋锁 | `$IDF_PATH/components/freertos/FreeRTOS-Kernel/portable/xtensa/include/freertos/portmacro.h:188` |
| `spinlock_t` 定义 | `$IDF_PATH/components/esp_hw_support/include/spinlock.h:45` |
| 双核数量（`SOC_CPU_CORES_NUM = 2`） | `$IDF_PATH/components/soc/esp32s3/include/soc/soc_caps.h:145` |
| ISR 写法参考（真工程） | `code/esp32/01-gpio-matrix/main/` |
| `volatile` 的边界清单 | [C3 volatile](../c/03-volatile.md) |
| 单核 NVIC 的对照系 | [S4 中断与 NVIC](../stm32/04-nvic-exti.md) |

> 表中 `$IDF_PATH` = `C:/Users/zhugu/.espressif/v5.5.2/esp-idf`（本机 ESP-IDF v5.5.2）。行号以该版本为准，换版本需重核。

## 你做到了

- 知道了"IRAM 纪律"不是玄学：它是 Cache 映射执行的必然推论；
- 能正确给外设挂中断——选对源、级别、IRAM 标志，并知道每个选择的责任；
- 双核共享数据时不再指望 `volatile`，会用 `portMUX` 与 `--FromISR` API；
- 能对着 STM32 的 NVIC 说清"静态向量 vs 动态中断矩阵"的差异。

<div class="achievement">
✅ 下一站：<a href="../../rtos/index.html">RTOS 篇</a>把双核 SMP 的调度细节补齐，或回 <a href="00-env.html">P0</a> 复查环境配置。
</div>
