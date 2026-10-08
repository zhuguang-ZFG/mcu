---
title: S14 低功耗：让电池活过一年
status: done
difficulty: 2
minutes: 30
---

# S14 低功耗：三种睡眠的唤醒与代价

> 🎯 电池产品的灵魂拷问：99% 的时间你的设备在睡觉——睡眠有多深、醒得多快、醒来还记得什么，决定了电池活一个月还是一年。

## 本章精髓

1. 三档睡眠的取舍：**Sleep**（只停 CPU，外设全醒，µs 级唤醒）→ **Stop**（停 1.2V 域时钟，SRAM/寄存器保留，RTC/EXTI 唤醒，µA~几十µA）→ **Standby**（几乎全断电，只留备份域，nA~µA，但 SRAM 全丢、复位式唤醒）。
2. 唤醒源是设计出来的：EXTI/RTC 闹钟/WKUP 引脚/IWDG——"谁能叫醒我"必须在入睡前配好，漏配=睡死。
3. 省电不止睡：降频、关外设时钟、GPIO 模拟态、关调试接口（DBGMCU 在 Stop 下也吃电）——系统级抠电。

## 怎么读这一章

- **能记住**：三档口诀"Sleep 停脑，Stop 停钟（记忆在），Standby 断电（只留遗言）"。
- **能理解**：为什么 Stop 醒来后系统跑在 HSI 16MHz（PLL 停了得重配）；为什么 Standby 唤醒是"复位"而不是"继续"。
- **能用**：进 Stop + RTC 闹钟周期唤醒，万用表量到电流从 mA 掉到 µA 的跳水。

## 学习目标

- 背出三档模式的"停什么/留什么/谁唤醒/醒来到哪"四列对比。
- 实现 Stop 模式 + RTC 闹钟周期唤醒，万用表（或电流表）实测运行/睡眠电流对比。
- 解释 Standby 唤醒为什么是"复位"，以及用备份寄存器/备份 SRAM 传递"睡前记忆"。

## 先修

- [S2 时钟](02-rcc-clock.md)、[S4 EXTI](04-nvic-exti.md)、[S5 SysTick](05-systick.md)。

## 先跑起来（10 分钟 quick win）

主循环跑 5 秒→进 Stop→RTC 2 秒后唤醒→串口打印"我醒了"循环——万用表串在供电上，看电流从 mA 掉到 µA 的跳水瞬间。

## 动画：低功耗三档对比

Sleep 只停 CPU、Stop 停 1.2V 域时钟保留 SRAM、Standby 几乎全断电——三档"停什么/留什么/谁唤醒/醒来到哪"逐档对照，深睡与快醒的取舍一目了然。

![低功耗三档对比：Sleep/Stop/Standby](/anim/stm32-pwr-three-modes.svg)

## 板卡事实

- PWR 控制器基址 `PWR_BASE = APB1 + 0x7000 = 0x40007000`（CMSIS 已核对）；时钟在 RCC_APB1ENR bit28 = `RCC_APB1ENR_PWREN_Msk`。
- PWR_CR 关键位：`LPDS`（bit0，Stop 下调压器低功耗）、`PDDS`（bit1，=1 进 Standby）、`CWUF`（bit2，清唤醒标志）、`CSBF`（bit3，清 Standby 标志）、`DBP`（bit8，解除备份域写保护）、`FPDS`（bit9，Stop 下 Flash 掉电）——CMSIS 逐位核对。
- PWR_CSR 关键位：`WUF`（bit0，唤醒标志）、`SBF`（bit1，Standby 标志）、`EWUP`（bit8，使能 WKUP 引脚 PA0）。
- 备份 SRAM **4 KB** 在 `BKPSRAM_BASE = 0x40024000`（CMSIS 已核对），时钟在 RCC_AHB1ENR bit18 = `RCC_AHB1ENR_BKPSRAMEN_Msk`（0x40000）；写之前必须 `PWR_CR.DBP=1` 解除备份域写保护。
- RTC 基址 `RTC_BASE = APB1 + 0x2800 = 0x40002800`；时钟使能在 RCC_BDCR.RTCEN，时钟源选 LSE/LSI（RCC_BDCR.RTCSEL）。
- 电流数值以 F407 datasheet §"Power consumption"为准——本章给量级（mA → µA → µA/nA）而非具体数，实测见 [E06](../lab/e06-lowpower-current.md)。

## 小节结构

| 小节 | 内容 | 四件套 |
|---|---|---|
| 三档对比 | 四列对照表 + 唤醒延迟实测数据 | 配置 |
| Sleep 与 WFI/WFE | `__WFI()` 一条指令的事；唤醒后时钟恢复检查 | 代码分析 |
| Stop 全流程 | 入睡前配置清单；唤醒后重配 PLL（HSI 默认接管） | 代码分析 |
| RTC 闹钟 | RTC 初始化与闹钟中断；LSI/LSE 精度对续航的影响 | 配置 |
| Standby 与备份域 | 备份寄存器传"睡前遗言"；WKUP 引脚 | 代码分析 |
| 抠电清单 | GPIO/调试接口/外设时钟/调压器档位逐项抠 | 配置 |
| SPL 对照 | PWR_EnterSTOPMode 的参数含义 | 库解析 |

## 一、三档对比：停什么、留什么、谁唤醒、醒来到哪

低功耗不是"省电模式"一个词，是一张取舍表。F407 提供三档，越深越省电，但醒来代价越大：

| 维度 | Sleep | Stop | Standby |
|---|---|---|---|
| **停什么** | CPU 时钟 | 1.2V 域时钟（CPU+大部分外设） | 调压器（1.2V 域断电） |
| **留什么** | SRAM、寄存器、所有外设时钟 | SRAM、寄存器、RTC、备份域 | **只有备份域**（备份寄存器+备份 SRAM） |
| **谁唤醒** | 任何使能的中断 | EXTI（上升/下降沿）、RTC 闹钟、部分外设 | WKUP 引脚（PA0）、RTC 闹钟、IWDG 复位、NRST |
| **醒来到哪** | WFI 的下一条指令 | WFI 的下一条指令（但 HSI 接管时钟） | **复位入口**（像重新上电） |
| **唤醒延迟** | µs 级 | µs 级（时钟要重启） | ms 级（调压器重启+复位） |
| **电流量级** | 接近运行（mA） | µA ~ 几十 µA | µA ~ nA |
| **核心寄存器** | SCB->SCR.SLEEPDEEP=0 | SCR.SLEEPDEEP=1 + PWR_CR.PDDS=0 | SCR.SLEEPDEEP=1 + PWR_CR.PDDS=1 |

读这张表的方法是"看代价"：Sleep 最浅（什么都没忘，但也没省多少）；Standby 最深（SRAM 全丢，醒来像重生，但电流最低）。**选哪档取决于"醒来还需要记得什么"**：要无缝继续 → Stop；可以接受重置 → Standby。

## 二、Sleep 与 WFI/WFE：一条指令的事

Sleep 是最轻的——只停 CPU 时钟，外设全活：

```c
#include "stm32f407.h"   /* CMSIS：SCB + __WFI/__WFE 内建 */

static void enter_sleep(void)
{
    SCB->SCR &= ~SCB_SCR_SLEEPDEEP_Msk;     /* SLEEPDEEP=0 → Sleep（不是 Stop） */
    __WFI();                                /* Wait For Interrupt：CPU 停在这里 */
    /* 任何使能的中断触发后，CPU 在这里醒来，执行 ISR 后回到 WFI 下一条 */
}
```

`__WFI()` 是一条 ARM 指令（CMSIS-Core 内建），CPU 停在这里直到中断到来。Sleep 的用途是"等事件"——主循环没事干时进 Sleep，比 `while(1){}` 死循环省 CPU 那一份动态功耗。唤醒后**时钟没变**（PLL 还在跑），不用重配。

WFE（Wait For Event）是变体：靠事件而非中断唤醒，可以用 `SEV` 指令跨核发事件（双核场景）。单核裸机绝大多数用 WFI。

## 三、Stop 全流程：入睡前清单 + 醒来重配 PLL

Stop 比 Sleep 深一档——1.2V 域时钟全停，但 SRAM 与寄存器保留。代价是醒来后**HSI 16MHz 默认接管**（PLL 在 Stop 期间也停了），系统时钟从 168MHz 掉到 16MHz，定时全慢 10 倍——这是骨架坑列表第一名的来源。

```c
static void enter_stop(void)
{
    /* 入睡前清单 */
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN_Msk;   /* 确保 GPIO 时钟开着才能改模式 */
    /* 1. 抠电：未用 GPIO 设模拟输入（见第六节清单） */
    /* 2. 关掉不需要的外设时钟（ADC、SPI 等若不用） */
    /* 3. 可选：Flash 在 Stop 下掉电（FPDS=1），更省一点 */
    PWR->CR |= PWR_CR_FPDS_Msk;

    /* 4. 选 Stop 模式：SLEEPDEEP=1 + PDDS=0 + 调压器低功耗 */
    SCB->SCR |= SCB_SCR_SLEEPDEEP_Msk;        /* SLEEPDEEP=1 → 进深睡 */
    PWR->CR &= ~PWR_CR_PDDS_Msk;              /* PDDS=0 → Stop（不是 Standby） */
    PWR->CR |= PWR_CR_LPDS_Msk;               /* LPDS=1：调压器进低功耗档 */

    __WFI();                                  /* 进 Stop——电流跳水到 µA */

    /* 5. 醒来：HSI 16MHz 接管，必须立刻重配 PLL */
    SystemClock_Config();                      /* 恢复 PLL 168MHz（[S2](02-rcc-clock.md) 的配置函数） */
    /* 醒来后第一件事检查 PWR_CSR.WUF（bit0）：是哪个唤醒源叫醒的 */
    if (PWR->CSR & PWR_CSR_WUF_Msk) {
        PWR->CR |= PWR_CR_CWUF_Msk;            /* 清 WUF：写 CWUF（bit2）清 */
    }
}
```

唤醒源必须在**入睡前**配好：EXTI 配上升沿（[S4](04-nvic-exti.md)）、RTC 闹钟（第四节）。Stop 唤醒是"继续"——WFI 下一条指令，但若忘了重配 PLL，程序会以为还在 168MHz，所有定时器全慢 10 倍，UART 波特率也错——典型的"醒来变痴呆"。

## 四、RTC 闹钟：周期唤醒的精准节拍

RTC 是 Stop/Standby 下唯一还在走的外设（靠 LSE/LSI 独立时钟），所以是周期唤醒的首选。配置链路（RTC 在备份域，写前要 DBP）：

```c
static void rtc_alarm_init_for_wakeup(uint32_t seconds)
{
    RCC->APB1ENR |= RCC_APB1ENR_PWREN_Msk;
    PWR->CR |= PWR_CR_DBP_Msk;                /* 解除备份域写保护（动 RTC 必备） */
    /* 时钟源选 LSE（外部 32.768kHz 晶振，精度高）或 LSI（内部 RC，省一个晶振但精度差） */
    RCC->BDCR |= RCC_BDCR_RTCEN_Msk;          /* 使能 RTC（RCC_BDCR bit15） */
    /* 选时钟源、配置 RTC 预分频与闹钟寄存器——细节以 RM0090 RTC 章为准 */
    /* 闹钟中断经 RTC_Alarm_IRQn → EXTI Line 17 唤醒（[S4](04-nvic-exti.md) 的 EXTI 路由） */
    /* 设闹钟 = 当前时间 + seconds，周期唤醒由"闹钟中断里重设下一次"实现 */
}
```

LSI vs LSE 的取舍直接关系续航：**LSE**（外部 32.768kHz）精度高（±20ppm）、功耗极低，是 RTC 标配；**LSI**（内部 RC，约 32kHz）省一个外部晶振但精度差（±5%）、随温度漂——长期定时（闹钟日历）必须 LSE，短时唤醒（"每 2 秒醒一次"）LSI 够用。RTC 闹钟唤醒经 EXTI Line 17（[S4](04-nvic-exti.md)），所以"RTC 唤醒 Stop"在硬件层面就是"EXTI 17 上升沿"。

## 五、Standby 与备份域：只留遗言的深度睡眠

Standby 是最深的——调压器关掉，1.2V 域断电，SRAM 全丢。醒来**不是继续**，是**复位**（PC 从 0 起跑，像重新上电）。唯一活下来的是备份域：备份寄存器（20 个 32 位字，RTC 寄存器区）+ 备份 SRAM（4KB）。

```c
static void enter_standby_with_message(const uint32_t *msg, uint32_t n)
{
    /* 1. 把"睡前遗言"写进备份 SRAM（Standby 后还在） */
    RCC->APB1ENR |= RCC_APB1ENR_PWREN_Msk;
    PWR->CR |= PWR_CR_DBP_Msk;                    /* 解除备份域写保护 */
    RCC->AHB1ENR |= RCC_AHB1ENR_BKPSRAMEN_Msk;    /* 开备份 SRAM 时钟 */
    uint32_t *bkp = (uint32_t *)BKPSRAM_BASE;      /* 0x40024000，4KB */
    for (uint32_t i = 0; i < n && i < 1024; i++) bkp[i] = msg[i];

    /* 2. 清旧标志、配唤醒源 */
    PWR->CR |= PWR_CR_CWUF_Msk | PWR_CR_CSBF_Msk;  /* 清 WUF/SBF */
    PWR->CSR |= PWR_CSR_EWUP_Msk;                  /* 使能 WKUP 引脚（PA0） */

    /* 3. 进 Standby：SLEEPDEEP=1 + PDDS=1 */
    SCB->SCR |= SCB_SCR_SLEEPDEEP_Msk;
    PWR->CR |= PWR_CR_PDDS_Msk;                    /* PDDS=1 → Standby */
    __WFI();                                       /* 进 Standby——不会返回 */

    /* 醒来 = 复位：从这里开始重来，靠 SBF 判断"我是不是刚从 Standby 醒来" */
}
```

复位后怎么知道"是上电"还是"刚从 Standby 醒来"——查 PWR_CSR.SBF（bit1）：

```c
/* 在 reset handler 或 main 早期 */
if (PWR->CSR & PWR_CSR_SBF_Msk) {
    /* 是从 Standby 醒来，备份 SRAM 里的遗言还在 */
    PWR->CR |= PWR_CR_CSBF_Msk;     /* 清 SBF，下次上电就不会误判 */
    /* 读 BKPSRAM 取遗言 */
} else {
    /* 真上电，备份 SRAM 是 0 或上次值——按上电处理 */
}
```

"醒来是复位"是 Standby 与 Stop 的本质区别：Stop 醒来继续跑（只需重配时钟），Standby 醒来重生（要从备份域捡回状态）。设计取舍很直接：要无缝继续 → Stop；可以接受重置且要极致省电 → Standby。

## 六、抠电清单：睡前的系统级准备

光进低功耗模式不够，"漏电"的元凶常常是没伺候好的外设。入睡前逐项检查：

1. **未用 GPIO 设模拟输入**：悬空的数字输入脚在漏电流上"喝电"——配成模拟输入（MODER=0b11）或确定上下拉，把漏电流通道关掉；
2. **关掉不需要的外设时钟**：ADC、SPI、USART 若不用，RCC 位清掉，外设静态功耗归零；
3. **关调试接口**：DBGMCU->CR 的 `DBG_STOP` / `DBG_STANDBY` 位若置着，Stop/Standby 下调试器还吃电——实测功耗时**必须拔掉仿真器**并清这两位，否则电流虚高一个数量级；
4. **调压器档位**：Stop 下用 LPDS=1（低功耗档）；F4 的 VOS（电压调节输出）在运行时也能降档（PWR_CR.VOS），降一档省一档电，代价是最高频率受限；
5. **Flash 掉电**：FPDS=1 让 Flash 在 Stop 下断电，省一点，代价是唤醒后第一次取指稍慢；
6. **IWDG 还在跑**：[S5](05-systick.md) 提过 IWDG 靠 LSI 独立跑，Stop 期间也计数——若 Stop 时间超过 IWDG 超时，醒来就是 IWDG 复位。要么睡前喂狗+算好超时，要么进 Stop 前关 IWDG（但关了就没了看门狗保护）。

这张清单的全部项都能在 [E06](../lab/e06-lowpower-current.md) 实测里逐一开/关对比——每关一项量一次电流，量化每一项的省电贡献。

## 七、SPL 对照：`PWR_EnterSTOPMode` 的参数

SPL 把"进 Stop"包成一个函数（stm32f4xx_pwr.c V1.8.0）：

```c
void PWR_EnterSTOPMode(uint32_t PWR_Regulator, uint8_t PWR_STOPEntry)
{
    /* PWR_Regulator: PWR_Regulator_LowPower → LPDS=1；PWR_Regulator_ON → LPDS=0 */
    /* PWR_STOPEntry: PWR_STOPEntry_WFI / PWR_STOPEntry_WFE */
    tmpreg = PWR->CR;
    if (PWR_Regulator == PWR_Regulator_LowPower) tmpreg |= PWR_CR_LPDS;
    else tmpreg &= ~PWR_CR_LPDS;
    PWR->CR = tmpreg;
    SCB->SCR |= SCB_SCR_SLEEPDEEP_Msk;       /* 第三节逐行版 */
    if (PWR_STOPEntry == PWR_STOPEntry_WFI) __WFI();
    else __WFE();
    /* 醒来后 SPL 不替你重配 PLL——这是用户的责任（坑列表第一名） */
}
```

看一眼就明白：SPL 的 `PWR_EnterSTOPMode` 就是第三节的几行寄存器序列，参数 `PWR_Regulator` 选调压器档位、`PWR_STOPEntry` 选 WFI 还是 WFE。**SPL 不替你重配 PLL**——醒来后时钟恢复仍是用户责任（这是为什么"Stop 醒来变痴呆"是 SPL 用户和寄存器用户共同的坑）。`PWR_EnterSTANDBYMode` 同理：设 PDDS + SLEEPDEEP + WFI，不返回。

读库姿势照旧（[S15](15-spl-anatomy.md)）：拿到 `PWR_EnterSTOPMode` 先问"它动了 CR 与 SCR 的哪几位"，逐位与第三节对答案——低功耗的"魔法"全在 PDDS/LPDS/SLEEPDEEP 这三个位上，库没多做什么。

## 附录：本章代码落点

本章 Sleep/Stop/Standby/备份域配置以内联代码呈现（无独立工程），可直接进任何项目主组件。PWR/BKPSRAM/RTC 寄存器位定义对照 CMSIS `stm32f407.h`（本站 `.trellis/ref/cmsis/`）；电流实测见 [E06](../lab/e06-lowpower-current.md)。

## 记忆锚点

::: tip 一句话记住
**Sleep 停脑，Stop 停钟（记忆在），Standby 断电（只留遗言）；唤醒源睡前配，醒来先查钟。**
:::

## 实物实验

- [E06 功耗实测](../lab/e06-lowpower-current.md)：三种模式电流逐一记录，算出"1 节 CR2032 能活多久"的估算表。

## 常见坑

- **Stop 唤醒后忘重配时钟**：系统跑在 HSI 16MHz，定时全慢 10 倍——唤醒后第一件事恢复 PLL。
- **调试器插着测电流**：SWD 连接让 Stop 电流虚高一个数量级——测功耗时拔掉仿真器。
- **GPIO 悬空耗电**：悬空输入在漏电流上"喝电"——睡前全配模拟输入或确定上下拉。
- **Standby 后找变量**：SRAM 已清空，"睡前变量"必须用备份寄存器/备份 SRAM。
- **IWDG 在 Stop 里还在数**：超时就是 IWDG 复位，不是"醒来"——睡前算好超时或关 IWDG。

## 短自测

1. Stop 和 Standby 醒来的"到哪"有什么本质区别？为什么 Standby 后变量全丢？
<details><summary>参考答案</summary>Stop 醒来回到 WFI 的下一条指令（继续跑），SRAM 与寄存器都保留——只是时钟停了得重配。Standby 醒来回到**复位入口**（像重新上电），因为调压器关了、1.2V 域断电、SRAM 内容全失。Standby 后变量全丢正是因为 SRAM 没有供电保留，只有备份域（备份寄存器+备份 SRAM）还活着——要留状态就得睡前写进备份域。</details>

2. 为什么 Stop 唤醒后系统时钟是 HSI 16MHz 而不是 168MHz？醒来后第一件事该做什么？
<details><summary>参考答案</summary>Stop 期间 1.2V 域时钟全停，包括 PLL（PLL 靠 HSE/HSI 倍频，停了就不出 168MHz）。醒来硬件自动启 HSI 作为系统时钟（保证最低能跑），但 PLL 没自动重启。第一件事是调 SystemClock_Config 重新配 PLL 切回 168MHz——否则所有定时器、UART 波特率都按 16MHz 算，全错 10 倍。</details>

3. 怎么在复位后区分"真上电"和"刚从 Standby 醒来"？
<details><summary>参考答案</summary>查 PWR_CSR.SBF（bit1，Standby Flag）。硬件在 Standby 唤醒时置 SBF，上电时 SBF=0。读 SBF=1 就是"刚从 Standby 醒来"，可以从备份 SRAM 捡回遗言；读 SBF=0 就是真上电。处理后写 PWR_CR.CSBF 清标志，避免下次上电误判。</details>

4. LSI 和 LSE 给 RTC 用，精度与续航怎么取舍？
<details><summary>参考答案</summary>LSE（外部 32.768kHz 晶振）精度高（±20ppm）、功耗极低，是 RTC 标配——长期定时（日历、闹钟）必须用它。LSI（内部 RC，约 32kHz）省一个外部晶振、BOM 成本低，但精度差（±5%）且随温度漂——短时周期唤醒（"每 2 秒醒一次"）够用，长期累计会偏。续航上两者都很省（µA 级），主要差别是精度而非功耗。</details>

5. 测 Stop 电流时为什么要拔掉 ST-Link？
<details><summary>参考答案</summary>ST-Link 通过 SWD 连着芯片，DBGMCU->CR 的 DBG_STOP 位若置着，Stop 下调试器还维持着调试接口的供电与时钟，电流虚高一个数量级。即便清了 DBG_STOP，SWD 物理连接本身的漏电也会引入误差。测真实 Stop 电流必须拔掉仿真器、清 DBG_STOP/DBG_STANDBY，让芯片真正"独自睡眠"。</details>

## 对照表：本章概念 → 仓库与上游落点

| 概念 | 落点 |
|---|---|
| PWR_CR/CSR 位（LPDS/PDDS/CWUF/CSBF/DBP/FPDS/WUF/SBF/EWUP） | CMSIS `stm32f407.h`（本站 `.trellis/ref/cmsis/`，逐位核对） |
| SCB->SCR.SLEEPDEEP | CMSIS-Core `core_cm4.h`（bit2） |
| 备份 SRAM 4KB @ 0x40024000 | 同上 `BKPSRAM_BASE`；时钟 RCC_AHB1ENR bit18 |
| RTC 基址与 EXTI Line 17 路由 | CMSIS `RTC_BASE`；[S4 EXTI](04-nvic-exti.md) |
| 三档电流实测 | [E06 低功耗电流实测](../lab/e06-lowpower-current.md) |
| PLL 重配函数 | [S2 RCC](02-rcc-clock.md) SystemClock_Config |

## 你做到了

- 低功耗从"省电模式"三个字变成可设计、可测量、可核算的工程；
- 电池产品的续航估算有了第一性原理。

<div class="achievement">
✅ 下一站：<a href="15-spl-anatomy.html">S15 SPL 库解剖</a>——把标准库拆开，看它如何封装我们手写的每一行。
</div>
