/**
 * main.c —— 02-tim-pwm：一个计数器，两种用法（输出 PWM / 测量周期）
 *
 * TIM 的本质只有一个东西：一个按固定节拍往上数的计数器 CNT。
 * 剩下的一切都是"拿 CNT 和别的寄存器比一比"：
 *   - 拿 CNT 和 ARR 比 → 数到几就归零，决定"一个周期有多长"
 *   - 拿 CNT 和 CCR 比 → 比小比大决定输出电平，决定"一个周期里高电平占多久"
 *   - 引脚上一个边沿把当时的 CNT 拍下来存进 CCR → 这就是输入捕获
 *
 * 因此本章只用一个定时器（TIM3）同时演示两条路：
 *   CH1 (PA6, AF2) 输出 1kHz PWM
 *   CH2 (PA7, AF2) 捕获这个方波，硬件算出周期，CPU 只做减法
 *
 * 自测闭环：用一根杜邦线把 PA6 接到 PA7，不接也能跑，
 * 只是 g_measured_hz 会一直是 0（捕获不到边沿）。
 *
 * 另一个容易被忽略的知识点在本文件里被实测出来：
 * **APBx 预分频 ≠ 1 时，定时器时钟 = PCLK × 2**。
 * 代码会先在 APB1=/1 下测一次定时器时钟，再切到 APB1=/2 测一次，
 * 你会看到 PCLK1 掉了一半、定时器时钟却纹丝不动——这就是那条隐藏规则。
 *
 * 引脚依据：DS8626 Table 9，PA6/PA7 的 TIM3_CH1/TIM3_CH2 都在 AF2。
 *          顺带纠正一个常见误解：F407 的 Port F 上根本没有 TIM3 通道，
 *          PF6/PF7/PF8 在 AF3 上是 TIM10_CH1 / TIM11_CH1 / TIM13_CH1。
 */

#include <stdint.h>

/* ============================ 寄存器定义 ============================
 * 基址/偏移取自 ST 官方 CMSIS 头文件 cmsis_device_f4 的 stm32f407xx.h：
 *   TIM3_BASE = APB1PERIPH_BASE + 0x0400 = 0x40000400
 *   GPIOA_BASE = AHB1PERIPH_BASE + 0x0000 = 0x40020000
 *   GPIOF_BASE = AHB1PERIPH_BASE + 0x1400 = 0x40021400
 *   RCC_BASE  = AHB1PERIPH_BASE + 0x3800 = 0x40023800
 */
#define RCC_BASE        (0x40023800UL)
#define RCC_CFGR        (*(volatile uint32_t *)(RCC_BASE + 0x08UL))
#define RCC_AHB1ENR     (*(volatile uint32_t *)(RCC_BASE + 0x30UL))

#define GPIOA_BASE      (0x40020000UL)
#define GPIOA_MODER     (*(volatile uint32_t *)(GPIOA_BASE + 0x00UL))
#define GPIOA_AFRL      (*(volatile uint32_t *)(GPIOA_BASE + 0x20UL)) /* 引脚 0..7 */

#define GPIOF_BASE      (0x40021400UL)
#define GPIOF_MODER     (*(volatile uint32_t *)(GPIOF_BASE + 0x00UL))
#define GPIOF_BSRR      (*(volatile uint32_t *)(GPIOF_BASE + 0x18UL))

#define TIM3_BASE       (0x40000400UL)
#define TIM3_CR1        (*(volatile uint32_t *)(TIM3_BASE + 0x00UL))
#define TIM3_DIER       (*(volatile uint32_t *)(TIM3_BASE + 0x0CUL))
#define TIM3_SR         (*(volatile uint32_t *)(TIM3_BASE + 0x10UL))
#define TIM3_EGR        (*(volatile uint32_t *)(TIM3_BASE + 0x14UL))
#define TIM3_CCMR1      (*(volatile uint32_t *)(TIM3_BASE + 0x18UL))
#define TIM3_CCER       (*(volatile uint32_t *)(TIM3_BASE + 0x20UL))
#define TIM3_CNT        (*(volatile uint32_t *)(TIM3_BASE + 0x24UL))
#define TIM3_PSC        (*(volatile uint32_t *)(TIM3_BASE + 0x28UL))
#define TIM3_ARR        (*(volatile uint32_t *)(TIM3_BASE + 0x2CUL))
#define TIM3_CCR1       (*(volatile uint32_t *)(TIM3_BASE + 0x34UL))
#define TIM3_CCR2       (*(volatile uint32_t *)(TIM3_BASE + 0x38UL))
/* ---- 位定义（同样对应该头文件） ---- */
#define TIM_CR1_CEN     (1UL << 0)
#define TIM_CR1_ARPE    (1UL << 7)   /* ARR 预装载：改 ARR 不影响当前这一拍 */
#define TIM_EGR_UG      (1UL << 0)   /* 立刻把 PSC/ARR 的影子寄存器搬上去 */
#define TIM_SR_UIF      (1UL << 0)
#define TIM_SR_CC2IF    (1UL << 2)
#define TIM_CCMR1_CC1S  (0x3UL << 0)  /* 00=输出模式 */
#define TIM_CCMR1_OC1M  (0x7UL << 4)
#define TIM_CCMR1_OC1M_PWM1 (0x6UL << 4)  /* 110 = PWM 模式 1 */
#define TIM_CCMR1_OC1PE (1UL << 3)    /* CCR 预装载 */
#define TIM_CCMR1_CC2S  (0x3UL << 8)  /* 01=捕获模式，映射到 TI2 */
#define TIM_CCMR1_IC2F  (0xFUL << 12) /* 输入滤波 */
#define TIM_CCMR1_CC2S_0  (0x1UL << 8)  /* CC2S=01：捕获模式，源为 TI2 */
#define TIM_CCER_CC1E   (1UL << 0)
#define TIM_CCER_CC2E   (1UL << 4)

#define SysTick_CTRL    (*(volatile uint32_t *)(0xE000E010UL))
#define SysTick_LOAD    (*(volatile uint32_t *)(0xE000E014UL))
#define SysTick_VAL     (*(volatile uint32_t *)(0xE000E018UL))

#define LED_R_PIN 6U    /* 红灯 */
#define LED_B_PIN 8U    /* 蓝灯 */
#define PWM_PIN  6U     /* PA6 -> TIM3_CH1 */
#define CAP_PIN  7U     /* PA7 -> TIM3_CH2 */

#define PWM_PERIOD_TICKS 999U   /* ARR：计到 999 归零 → 1000 拍一个周期 */
#define COUNT_HZ         1000000UL /* 把计数时钟规整到 1MHz */

#ifndef HSE_VALUE_HZ
#define HSE_VALUE_HZ 8000000UL /* 本工程默认跑在 HSI；这个宏只在"已切到 PLL 且源是 HSE"时才会用到，
                                 数值错了只会让推导出的时钟偏掉，不会报错——按你板上的晶振填。 */
#endif

/* ============================ 观测量 ============================ */
volatile uint32_t g_hclk;             /* HCLK */
volatile uint32_t g_pclk1_before;     /* APB1=/1 时的 PCLK1 */
volatile uint32_t g_tim_clk_before;   /* APB1=/1 时的 TIM3 时钟 */
volatile uint32_t g_pclk1_after;      /* APB1=/2 时的 PCLK1 */
volatile uint32_t g_tim_clk_after;    /* APB1=/2 时的 TIM3 时钟 —— 应当与上面相同 */
volatile uint32_t g_pwm_hz;           /* 理论 PWM 频率 */
volatile uint32_t g_measured_hz;      /* 捕获实测频率，0 表示还没抓到边沿 */
volatile uint32_t g_capture_edges;    /* 累计捕获次数 */

static volatile uint32_t g_ms;
void SysTick_Handler(void) { g_ms++; }

static void delay_ms(uint32_t ms)
{
    uint32_t t0 = g_ms;
    while ((g_ms - t0) < ms) { }
}

static void systick_init(uint32_t hclk)
{
    g_ms = 0;
    SysTick_CTRL = 0;
    SysTick_LOAD = hclk / 1000UL - 1UL;
    SysTick_VAL  = 0;
    SysTick_CTRL = 0x7UL;
}

/* ============================ GPIO ============================ */

static void led_init(void)
{
    RCC_AHB1ENR |= (1UL << 5);                        /* GPIOFEN */
    GPIOF_MODER &= ~(3UL << (LED_R_PIN * 2));
    GPIOF_MODER |=  (1UL << (LED_R_PIN * 2));
    GPIOF_MODER &= ~(3UL << (LED_B_PIN * 2));
    GPIOF_MODER |=  (1UL << (LED_B_PIN * 2));
}

static void led_set(uint32_t pin, uint32_t on)
{
    GPIOF_BSRR = on ? (1UL << (pin + 16)) : (1UL << pin);
}

static void gpioa_af2(uint32_t pin)
{
    RCC_AHB1ENR |= (1UL << 0);                        /* GPIOAEN */
    GPIOA_MODER &= ~(3UL << (pin * 2));
    GPIOA_MODER |=  (2UL << (pin * 2));               /* 10 = 复用功能 */
    GPIOA_AFRL &= ~(0xFUL << (pin * 4));
    GPIOA_AFRL |=  (2UL << (pin * 4));                /* AF2 = TIM3 */
}

/* ============================ 时钟读回 ============================ */

/** 从 RCC_CFGR 反推当前各级时钟。
 *  为什么要"读回来算"而不是"照着自己写的配置算"：
 *  位写错、被复位、被硬件改写，只有寄存器里的值是事实。 */
static void clocks_read(uint32_t hsi_hz, uint32_t *hclk, uint32_t *pclk1)
{
    /* RM0090 Rev 18：HPRE 0xxx=/1、1000=/2、1001=/4、1010=/8、1011=/16、
     * 1100=/64、1101=/128、1110=/256、1111=/512（F4 没有 /32 这一档） */
    static const uint16_t hpre_div[] = { 1,1,1,1,1,1,1,1,2,4,8,16,64,128,256,512 };
    /* PPRE1/PPRE2：0xx=/1、100=/2、101=/4、110=/8、111=/16 */
    static const uint16_t ppre_div[] = { 1,1,1,1,1,1,1,1,2,4,8,16,16,16,16,16 };

    uint32_t cfgr = RCC_CFGR;
    uint32_t src  = hsi_hz;
    uint32_t ppre1_code = (cfgr >> 10) & 0x7UL;

    if ((cfgr & 0x3UL) == 0x2UL) {            /* SWS = 10b 表示当前跑在 PLL 上 */
        uint32_t pll = *(volatile uint32_t *)(RCC_BASE + 0x04UL);
        uint32_t m =  pll & 0x3FUL;
        uint32_t n = (pll >> 6) & 0x1FFUL;
        uint32_t p = ((pll >> 16) & 0x3UL) ? 4UL : 2UL;
        uint32_t hse = (pll & (1UL << 22)) ? HSE_VALUE_HZ : hsi_hz;
        src = hse / m * n / p;
    }

    *hclk  = src / hpre_div[(cfgr >> 4) & 0xFUL];
    *pclk1 = *hclk / ppre_div[ppre1_code];
}

/** 定时器时钟的隐藏规则：挂在 APB1/2 上的定时器，当预分频 ≠ 1 时时钟 ×2。
 *  这么设计是为了让 PCLK 降频时定时器时钟不至于跟着大幅变慢。 */
static uint32_t timer_clock(uint32_t pclk, uint32_t ppre_code)
{
    return (ppre_code != 0UL) ? pclk * 2UL : pclk;
}

/* ============================ TIM3 ============================ */

static void tim3_pwm_init(uint32_t tim_clk)
{
    TIM3_PSC = (tim_clk / COUNT_HZ) - 1UL;      /* 先把计数时钟规整到 1MHz */
    TIM3_ARR = PWM_PERIOD_TICKS;                 /* 1000 拍 → 1kHz */

    /* CH1：PWM 模式 1 + CCR 预装载 + 输出模式 */
    TIM3_CCMR1 = (TIM3_CCMR1 & ~TIM_CCMR1_CC1S) | TIM_CCMR1_OC1M_PWM1 | TIM_CCMR1_OC1PE;
    TIM3_CCR1 = PWM_PERIOD_TICKS / 2U + 1U;      /* 50% 占空比 */
    TIM3_CCER |= TIM_CCER_CC1E;                  /* 输出使能：不开这个，引脚永远没波形 */

    /* CH2：输入捕获，映射 TI2，上升沿锁存，带一点数字滤波 */
    TIM3_CCMR1 = (TIM3_CCMR1 & ~TIM_CCMR1_CC2S) | TIM_CCMR1_CC2S_0 | (0x2UL << 12);
    TIM3_CCER |= TIM_CCER_CC2E;                  /* 捕获使能：不开这个，CC2IF 永远不来 */

    TIM3_EGR = TIM_EGR_UG;                       /* 立刻生效，别等第一个更新事件 */
    TIM3_SR  = 0;                                /* 清掉 UG 带出来的 UIF */
    TIM3_CR1 = TIM_CR1_ARPE | TIM_CR1_CEN;
}

static void tim3_set_duty(uint32_t ccr)
{
    TIM3_CCR1 = ccr;                             /* 预装载使能 → 下一个周期整点切换 */
}

/* ============================ main ============================ */

int main(void)
{
    led_init();
    gpioa_af2(PWM_PIN);
    gpioa_af2(CAP_PIN);

    uint32_t hclk, pclk1;

    /* 实验一：APB1 分频 = 1，定时器时钟就等于 PCLK1 */
    clocks_read(16000000UL, &hclk, &pclk1);
    g_hclk = hclk;
    g_pclk1_before  = pclk1;
    g_tim_clk_before = timer_clock(pclk1, (RCC_CFGR >> 10) & 0x7UL);

    /* 实验二：把 APB1 降到 /2，PCLK1 减半，定时器时钟不变 */
    RCC_CFGR = (RCC_CFGR & ~(0x7UL << 10)) | (0x4UL << 10);   /* PPRE1 = /2 */
    clocks_read(16000000UL, &hclk, &pclk1);
    g_pclk1_after = pclk1;
    g_tim_clk_after = timer_clock(pclk1, (RCC_CFGR >> 10) & 0x7UL);

    /* 回到常规的 APB1 = /1，再定时器 */
    RCC_CFGR = (RCC_CFGR & ~(0x7UL << 10));
    clocks_read(16000000UL, &hclk, &pclk1);
    g_hclk = hclk;
    systick_init(hclk);

    tim3_pwm_init(timer_clock(pclk1, 0UL));
    g_pwm_hz = COUNT_HZ / (PWM_PERIOD_TICKS + 1U);

    uint32_t ccr_last = 0;
    uint32_t phase = 0;

    while (1) {
        /* 呼吸灯：只动 CCR1，频率恒定 1kHz——这是"占空比和频率分家"的直观演示 */
        phase = (phase + 1U) % 200U;
        uint32_t ccr = (phase < 100U)
                     ? (phase + 1U) * (PWM_PERIOD_TICKS + 1U) / 100U
                     : (200U - phase) * (PWM_PERIOD_TICKS + 1U) / 100U;
        tim3_set_duty(ccr);
        delay_ms(20);

        /* 捕获：硬件把边沿时刻的 CNT 锁进 CCR2，CPU 只算差值 */
        if (TIM3_SR & TIM_SR_CC2IF) {
            TIM3_SR &= ~TIM_SR_CC2IF;
            uint32_t now  = TIM3_CCR2;
            uint32_t delta = now - ccr_last;      /* 无符号减法天然处理回绕 */
            ccr_last = now;
            g_capture_edges++;

            if (delta != 0U) {
                g_measured_hz = COUNT_HZ / delta;
            }
        }

        /* 红灯 1Hz 心跳；蓝灯表示"已经测到接近 1kHz 的方波" */
        static uint32_t beat;
        if (++beat >= 500U) { beat = 0; led_set(LED_R_PIN, 1); }
        else if (beat == 2U) { led_set(LED_R_PIN, 0); }

        if (g_measured_hz != 0U && g_measured_hz > 900U && g_measured_hz < 1100U) {
            led_set(LED_B_PIN, 1);
        } else {
            led_set(LED_B_PIN, 0);
        }
    }
}