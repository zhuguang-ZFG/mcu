/**
 * main.c —— 05-framed-protocol：USART1 上的二进制帧协议（INFO/STATUS）
 *
 * 教学 point：协议自己定界（COBS + 0x00 分隔符），IDLE/超时只是"该看一眼了"的
 * 通知，不是帧边界。板子上电后协议口（USART1）只发二进制帧——文本调试走 SWD
 * 读内存变量，这条线上不混任何日志，否则会把 COBS 码流撕碎。
 *
 * 接线（USB-TTL ↔ 板）：
 *   TTL TX  → PA10 (USART1_RX)
 *   TTL RX  → PA9  (USART1_TX)
 *   GND     → GND（3.3V 电平，共地）
 * 上电后用主机工具试：
 *   python3 scripts/device-console.py info  --port COMx
 *   python3 scripts/device-console.py status --port COMx
 *
 * 数据通路（复用 03-uart-dma 的 DMA 位置模型）：
 *   USART1_RX --DMA2_Stream5(循环 256B)--> dma_buf
 *   HT/TC/IDLE 中断有界搬运 → byte_queue(512B)
 *   主循环弹出 → device_service_feed()（协议解析在任务层）
 *   响应经 protocol_tx_step() → TXE 轮询 → USART1_TX
 *
 * 失步恢复：DMA 错误/RX 溢出/UART 错误 → protocol_rx_loss() 进入 DISCARD，
 * 下一个 0x00 重新同步；之后的合法帧照常接收（见公共模块状态机合同）。
 */

#include <stdint.h>
#include <string.h>
#include "../../common/behavior/circular.h"
#include "../../common/reliability/service.h"

/* ============================ 寄存器（出处：.trellis/ref/cmsis/stm32f407xx.h） ============================ */

#define USART1_BASE   (0x40011000UL)   /* APB2PERIPH_BASE + 0x1000 */
#define DMA2_BASE     (0x40026400UL)
#define DMA2_S5_BASE  (DMA2_BASE + 0x088UL)
#define DMA2_HISR     (*(volatile uint32_t *)(DMA2_BASE + 0x04UL))
#define DMA2_HIFCR    (*(volatile uint32_t *)(DMA2_BASE + 0x0CUL))

#define GPIOA_MODER   (*(volatile uint32_t *)(0x40020000UL + 0x00UL))
#define GPIOA_AFRH    (*(volatile uint32_t *)(0x40020000UL + 0x24UL))
#define GPIOF_MODER   (*(volatile uint32_t *)(0x40021400UL + 0x00UL))
#define GPIOF_BSRR    (*(volatile uint32_t *)(0x40021400UL + 0x18UL))

#define RCC_BASE      (0x40023800UL)
#define RCC_CSR       (*(volatile uint32_t *)(RCC_BASE + 0x34UL))  /* 复位原因在这 */
#define RCC_AHB1ENR   (*(volatile uint32_t *)(RCC_BASE + 0x30UL))
#define RCC_APB2ENR   (*(volatile uint32_t *)(RCC_BASE + 0x44UL))

#define USART1_RX_STREAM        5U   /* RM0090 Table 43：USART1_RX → DMA2 Stream5 Ch4 */
#define USART1_RX_CHANNEL       4U
#define DMA_S5_CR   (*(volatile uint32_t *)(DMA2_S5_BASE + 0x00UL))
#define DMA_S5_NDTR (*(volatile uint32_t *)(DMA2_S5_BASE + 0x04UL))
#define DMA_S5_PAR  (*(volatile uint32_t *)(DMA2_S5_BASE + 0x08UL))
#define DMA_S5_M0AR (*(volatile uint32_t *)(DMA2_S5_BASE + 0x0CUL))
#define DMA_S5_FCR  (*(volatile uint32_t *)(DMA2_S5_BASE + 0x14UL))

#define USART1_SR    (*(volatile uint32_t *)(USART1_BASE + 0x00UL))
#define USART1_DR    (*(volatile uint32_t *)(USART1_BASE + 0x04UL))
#define USART1_BRR   (*(volatile uint32_t *)(USART1_BASE + 0x08UL))
#define USART1_CR1   (*(volatile uint32_t *)(USART1_BASE + 0x0CUL))
#define USART1_CR2   (*(volatile uint32_t *)(USART1_BASE + 0x10UL))
#define USART1_CR3   (*(volatile uint32_t *)(USART1_BASE + 0x14UL))
#define USART_SR_RXNE (1UL << 5)
#define USART_SR_IDLE (1UL << 4)
#define USART_SR_ORE  (1UL << 3)
#define USART_SR_NE   (1UL << 2)
#define USART_SR_FE   (1UL << 1)
#define USART_SR_TXE  (1UL << 7)

#define USART_CR1_RE     (1UL << 2)
#define USART_CR1_TE     (1UL << 3)
#define USART_CR1_IDLEIE (1UL << 4)
#define USART_CR1_UE     (1UL << 13)
#define USART_CR3_DMAR   (1UL << 6)

#define DMA_SxCR_EN     (1UL << 0)
#define DMA_SxCR_TEIE   (1UL << 2)
#define DMA_SxCR_HTIE   (1UL << 3)
#define DMA_SxCR_TCIE   (1UL << 4)
#define DMA_SxCR_CIRC   (1UL << 8)
#define DMA_SxCR_MINC   (1UL << 10)
#define DMA_HISR_TEIF5  (1UL << 27)
#define DMA_HISR_HTIF5  (1UL << 28)
#define DMA_HISR_TCIF5  (1UL << 29)

#define NVIC_ISER1 (*(volatile uint32_t *)(0xE000E104UL))
#define NVIC_ISER2 (*(volatile uint32_t *)(0xE000E108UL))
#define NVIC_IPR_BYTE ((volatile uint8_t *)0xE000E400UL)

#define SysTick_CTRL (*(volatile uint32_t *)(0xE000E010UL))
#define SysTick_LOAD (*(volatile uint32_t *)(0xE000E014UL))
#define SysTick_VAL  (*(volatile uint32_t *)(0xE000E018UL))

/* 复位原因位：stm32f407xx.h:10320-10333（BORRSTF=25 … LPWRRSTF=31） */
#define RESET_CAUSE_MASK (0xFE000000UL)

#define LED_R_PIN 6U
#define LED_B_PIN 8U
#define DMA_RING  256U
#define BAUD      115200UL

/* ============================ 观测量（SWD 调试用） ============================ */

volatile uint32_t g_ms;            /* SysTick 毫秒 */
volatile uint32_t g_hclk;          /* 实际生效的 HCLK（SysTick 基准） */
volatile uint32_t g_pclk2;         /* 实际生效的 APB2 时钟（波特率基准） */
volatile uint32_t g_reset_csr;     /* 复位时的 RCC_CSR 原因位（bit25..31） */
volatile uint32_t g_brr;           /* 实际写入的 BRR */
volatile uint32_t g_uart_err;      /* ORE/FE/NE 次数 */
volatile uint32_t g_dma_bad;       /* DMA 错误/积压失步次数 */
volatile uint32_t g_tx_bytes;      /* 协议口发出的字节总数 */
volatile uint8_t  dma_buf[DMA_RING];

static dma_cursor_t rx_cursor;
static device_service_t g_service;
static byte_queue_t g_bytes;       /* ISR 生产 → 主循环消费（短临界区保护） */
static volatile uint8_t g_uart_err_flag;
static volatile uint8_t g_dma_bad_flag;

/* ============================ 时钟与引脚 ============================ */

static void clocks_read(volatile uint32_t *hclk, volatile uint32_t *pclk2)
{
    /* 本工程默认 HSI 16MHz 直驱 SYSCLK，HPRE/PPRE2=/1 → HCLK=PCLK2=16MHz。
     * 判据：CFGR SWS=00（HSI）。想换 PLL 时钟，把 03-uart-dma 的 clocks_read
     * 搬过来即可——协议解析不关心时钟，波特率必须跟着真实 PCLK2 走。 */
    *hclk = 16000000UL;
    *pclk2 = 16000000UL;
}

static void led_init(void)
{
    RCC_AHB1ENR |= (1UL << 5);                       /* GPIOFEN */
    GPIOF_MODER &= ~(3UL << (LED_R_PIN * 2));
    GPIOF_MODER |=  (1UL << (LED_R_PIN * 2));
    GPIOF_MODER &= ~(3UL << (LED_B_PIN * 2));
    GPIOF_MODER |=  (1UL << (LED_B_PIN * 2));
}

static void led_set(uint32_t pin, uint32_t on)
{
    GPIOF_BSRR = on ? (1UL << (pin + 16)) : (1UL << pin);
}

static void usart1_pins(void)
{
    RCC_AHB1ENR |= (1UL << 0);                       /* GPIOAEN */
    RCC_APB2ENR |= (1UL << 4);                       /* USART1EN */

    GPIOA_MODER &= ~(3UL << (9 * 2));
    GPIOA_MODER |=  (2UL << (9 * 2));                /* PA9  复用 */
    GPIOA_AFRH  &= ~(0xFUL << ((9 - 8) * 4));
    GPIOA_AFRH  |=  (7UL << ((9 - 8) * 4));          /* AF7 = USART1_TX */

    GPIOA_MODER &= ~(3UL << (10 * 2));
    GPIOA_MODER |=  (2UL << (10 * 2));               /* PA10 复用 */
    GPIOA_AFRH  &= ~(0xFUL << ((10 - 8) * 4));
    GPIOA_AFRH  |=  (7UL << ((10 - 8) * 4));         /* AF7 = USART1_RX */
}

/* ============================ 中断 → 队列 ============================ */

static void drain_dma(void)
{
    uint32_t flags = DMA2_HISR;
    uint32_t pos = (DMA_RING - DMA_S5_NDTR) % DMA_RING;
    flags |= DMA2_HISR; /* 采样 NDTR 后跨过边界也要算进来（见 03-uart-dma） */
    unsigned events = ((flags & DMA_HISR_HTIF5) ? 1U : 0U)
                    | ((flags & DMA_HISR_TCIF5) ? 2U : 0U)
                    | ((flags & DMA_HISR_TEIF5) ? 4U : 0U);
    DMA2_HIFCR = flags & (DMA_HISR_HTIF5 | DMA_HISR_TCIF5 | DMA_HISR_TEIF5);

    dma_span_t span = dma_consume(&rx_cursor, pos, DMA_RING, events);
    if (span.dropped) { ++g_dma_bad; g_dma_bad_flag = 1; return; }
    for (uint32_t i = 0; i < span.count; i++)
        if (!byte_queue_push(&g_bytes, dma_buf[(span.start + i) % DMA_RING]))
            return;   /* 队列溢出已在 push 内部置 loss，主循环会看到 */
}

void USART1_IRQHandler(void)
{
    uint32_t sr = USART1_SR;
    if (sr & (USART_SR_ORE | USART_SR_FE | USART_SR_NE | USART_SR_IDLE)) {
        (void)USART1_DR;      /* SR→DR 读序清标志；IDLE 不是协议边界 */
        if (sr & (USART_SR_ORE | USART_SR_FE | USART_SR_NE)) {
            ++g_uart_err;
            g_uart_err_flag = 1;
        }
        drain_dma();          /* IDLE 时把积压的尾段搬完 */
    }
}

void DMA2_Stream5_IRQHandler(void) { drain_dma(); }

/* ============================ 主循环侧 ============================ */

/** TX 写函数：能塞几个写几个（TXE 决定），返回实际字节数——0 = 本步零进展。 */
static size_t uart_write_some(void *user, const uint8_t *p, size_t n)
{
    (void)user;
    size_t sent = 0;
    while (sent < n && (USART1_SR & USART_SR_TXE)) {
        USART1_DR = p[sent];
        ++sent;
        ++g_tx_bytes;
    }
    return sent;
}

int main(void)
{
    led_init();
    usart1_pins();
    clocks_read(&g_hclk, &g_pclk2);

    SysTick_CTRL = 0;
    SysTick_LOAD = 16000000UL / 1000UL - 1UL;   /* HCLK=16MHz → 1kHz tick */
    SysTick_VAL  = 0;
    SysTick_CTRL = 0x7UL;

    /* 复位原因：必须先读后清。本工程不清 RMVF，把证据留给下一次复位。 */
    g_reset_csr = RCC_CSR & RESET_CAUSE_MASK;

    USART1_CR1 = 0;
    USART1_CR2 = 0;
    USART1_CR3 = 0;
    uint32_t brr = (16000000UL + BAUD / 2U) / BAUD;
    USART1_BRR = brr;
    g_brr = brr;
    USART1_CR1 = USART_CR1_UE | USART_CR1_TE | USART_CR1_RE | USART_CR1_IDLEIE;

    RCC_AHB1ENR |= (1UL << 22);                 /* DMA2EN */
    DMA_S5_CR = 0;
    while (DMA_S5_CR & DMA_SxCR_EN) { }
    DMA_S5_PAR  = USART1_BASE + 0x04UL;
    DMA_S5_M0AR = (uint32_t)(uintptr_t)dma_buf;
    DMA_S5_NDTR = DMA_RING;
    DMA_S5_FCR  = 0;
    DMA_S5_CR = DMA_SxCR_CIRC | DMA_SxCR_MINC
              | DMA_SxCR_HTIE | DMA_SxCR_TCIE | DMA_SxCR_TEIE
              | ((USART1_RX_CHANNEL & 0x7UL) << 25);
    USART1_CR3 |= USART_CR3_DMAR;
    DMA_S5_CR |= DMA_SxCR_EN;

    /* 最小命令服务：平台 1（F407）、无 health（watchdog 工程才有）、无故障注入 */
    device_service_init(&g_service, 1, g_reset_csr, false, NULL, NULL);

    NVIC_IPR_BYTE[37] = 0x60;                   /* USART1_IRQn */
    NVIC_IPR_BYTE[68] = 0x60;                   /* DMA2_Stream5_IRQn */
    NVIC_ISER1 |= (1UL << (37 - 32));
    NVIC_ISER2 |= (1UL << (68 - 64));

    /* 协议口不发文本横幅：COBS 码流不能混日志 */

    for (;;) {
        uint32_t now = g_ms;
        bool busy = false;

        if (g_uart_err_flag) { g_uart_err_flag = 0; protocol_rx_loss(&g_service.rx); busy = true; }
        if (g_dma_bad_flag) { g_dma_bad_flag = 0; protocol_rx_loss(&g_service.rx); busy = true; }

        for (;;) {
            uint8_t byte; bool loss = false;
            uint32_t mask;
            __asm__ volatile("mrs %0, primask\ncpsid i":"=r"(mask)::"memory");
            bool got = byte_queue_pop(&g_bytes, &byte, &loss);
            __asm__ volatile("msr primask, %0"::"r"(mask):"memory");
            if (!got) break;
            if (loss) protocol_rx_loss(&g_service.rx);
            device_service_feed(&g_service, byte, g_ms);
            busy = true;
        }

        uint32_t tx_before = g_tx_bytes;
        protocol_tx_step(&g_service.tx, now, uart_write_some, NULL);
        if (g_tx_bytes != tx_before) busy = true;

        led_set(LED_R_PIN, (g_ms / 500U) & 1U);
        led_set(LED_B_PIN, g_service.rx.stats.ok != 0U);

        if (!busy && !g_bytes.count && !g_service.tx.count)
            __asm__ volatile("wfi");            /* 空闲才睡；TXE 轮询在忙时全速跑 */
    }
}
