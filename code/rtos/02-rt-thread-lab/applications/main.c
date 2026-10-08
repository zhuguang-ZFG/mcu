/*
 * applications/main.c —— 02-rt-thread-lab：一个工程，两个场景（编译开关）
 *
 *   make                     scene 1（双线程异频闪灯：R7 验收点）
 *   make DEMO_SCENE=6        scene 6（优先级反转·信号量版，E04）
 *   make DEMO_SCENE=6 USE_MUTEX=1   scene 6（优先级反转·互斥量版）
 *
 * 与 01-freertos-lab 同构（E04 实验"FreeRTOS × RT-Thread 双跑"）：
 * FreeRTOS 的 xSemaphoreTake/xSemaphoreCreateMutex → RT-Thread 的
 * rt_sem_take/rt_mutex_take；优先级方向相反（RT-Thread 数值越小优先级越高）。
 */

#include <rtthread.h>
#include "board.h"

#ifndef DEMO_SCENE
#define DEMO_SCENE 1
#endif

#if (DEMO_SCENE < 1) || (DEMO_SCENE > 6)
#error "DEMO_SCENE must be 1 or 6"
#endif

/* ============================ 场景 1：双线程异频闪灯 ============================ */
#if DEMO_SCENE == 1

/* LED 在 PF6/PF7/PF8（霸天虎共阳，回 S0/S3） */
#define RCC_BASE   0x40023800UL
#define RCC_AHB1ENR (*(volatile uint32_t *)(RCC_BASE + 0x30UL))
#define GPIOF_BASE 0x40021400UL
#define GPIOF_MODER (*(volatile uint32_t *)(GPIOF_BASE + 0x00UL))
#define GPIOF_ODR   (*(volatile uint32_t *)(GPIOF_BASE + 0x14UL))

static void led_init(void)
{
    RCC_AHB1ENR |= (1UL << 5);                      /* GPIOF 时钟 */
    GPIOF_MODER = (GPIOF_MODER & ~(3UL << 14)) | (1UL << 14);   /* PF7 输出 */
    GPIOF_MODER = (GPIOF_MODER & ~(3UL << 16)) | (1UL << 16);   /* PF8 输出 */
}

static void thread_fast(void *param)
{
    (void)param;
    while (1) {
        GPIOF_ODR ^= (1UL << 7);                    /* 快闪：200ms */
        rt_thread_mdelay(200);
    }
}

static void thread_slow(void *param)
{
    (void)param;
    while (1) {
        GPIOF_ODR ^= (1UL << 8);                    /* 慢闪：500ms */
        rt_thread_mdelay(500);
    }
}

static void scene_start(void)
{
    led_init();
    rt_kprintf("scene=1 two threads blink (200ms vs 500ms)\r\n");
    /* RT-Thread：数字越小优先级越高；两个不同优先级体现"抢占调度" */
    rt_thread_create("fast", thread_fast, RT_NULL, 512, 8, 20);
    rt_thread_create("slow", thread_slow, RT_NULL, 512, 9, 20);
}

#endif /* DEMO_SCENE == 1 */

/* ============================ 场景 6：优先级反转（E04） ============================ */
#if DEMO_SCENE == 6

/*
 * 三任务演一出戏（与 01-freertos-lab scene 6 同构）：
 *   L 拿锁干 3s 长活，M 死循环抢占 L，H 等锁。
 *   信号量版：H 被 M 间接阻塞（反转）；互斥量版：L 被继承抬级，M 插不进（修复）。
 * 对应实验：E04 优先级反转复现（RT-Thread 版）。
 */
static rt_sem_t g_lock_sem;
static rt_mutex_t g_lock_mtx;

static void task_low(void *param)
{
    (void)param;
    while (1) {
        rt_kprintf("L take\r\n");
#ifdef USE_MUTEX
        rt_mutex_take(g_lock_mtx, RT_WAITING_FOREVER);
        rt_kprintf("L got lock, working 3s\r\n");
        rt_thread_mdelay(3000);
        rt_kprintf("L give\r\n");
        rt_mutex_release(g_lock_mtx);
#else
        rt_sem_take(g_lock_sem, RT_WAITING_FOREVER);
        rt_kprintf("L got lock, working 3s\r\n");
        rt_thread_mdelay(3000);
        rt_kprintf("L give\r\n");
        rt_sem_release(g_lock_sem);
#endif
        rt_thread_mdelay(5000);                     /* 睡 5s 后再来 */
    }
}

static void task_mid(void *param)
{
    (void)param;
    rt_thread_mdelay(500);                          /* 错峰：等 L 拿到锁后再启动 */
    while (1) {
        rt_kprintf("mid: running\r\n");             /* 死循环干活，不碰锁 */
        rt_thread_mdelay(100);
    }
}

static void task_high(void *param)
{
    (void)param;
    rt_thread_mdelay(1000);                         /* 等 L 进临界区、M 在跑后再要锁 */
    while (1) {
        rt_kprintf("high: want lock\r\n");
        rt_tick_t t0 = rt_tick_get();
#ifdef USE_MUTEX
        rt_mutex_take(g_lock_mtx, RT_WAITING_FOREVER);
#else
        rt_sem_take(g_lock_sem, RT_WAITING_FOREVER);
#endif
        rt_tick_t waited = rt_tick_get() - t0;
        rt_kprintf("high: got lock, waited %d ticks\r\n", (int)waited);
#ifdef USE_MUTEX
        rt_mutex_release(g_lock_mtx);
#else
        rt_sem_release(g_lock_sem);
#endif
        rt_kprintf("high: give\r\n");
        rt_thread_mdelay(5000);
    }
}

static void scene_start(void)
{
    /* 编译期二选一：USE_MUTEX=1 用互斥量（带优先级继承），=0 用信号量（无继承） */
#ifdef USE_MUTEX
    g_lock_mtx = rt_mutex_create("lock", RT_IPC_FLAG_PRIO);
    rt_kprintf("scene=6 mutex (with inheritance)\r\n");
#else
    g_lock_sem = rt_sem_create("lock", 1, RT_IPC_FLAG_PRIO);   /* 初值 1 = 二值信号量已 give */
    rt_kprintf("scene=6 semaphore (no inheritance)\r\n");
#endif
    /* RT-Thread 优先级：数值越小优先级越高。H=20 高、M=21 中、L=22 低
     * （与 FreeRTOS 相反——FreeRTOS 数值越大优先级越高，E04 对照时注意） */
    rt_thread_create("L", task_low,  RT_NULL, 512, 22, 20);
    rt_thread_create("M", task_mid,  RT_NULL, 512, 21, 20);
    rt_thread_create("H", task_high, RT_NULL, 512, 20, 20);
}

#endif /* DEMO_SCENE == 6 */

/* ============================ 启动 ============================ */

/* 场景线程不能在 main 里直接跑（调度器未启动），统一由 scene_start 创建 */
int main(void)
{
    /* Nano 手动启动序列（R7 第一节）：时钟/堆在 rt_hw_board_init */
    rt_hw_board_init();
    rt_system_timer_init();
    rt_system_scheduler_init();
    rt_thread_idle_init();

    scene_start();

    rt_system_scheduler_start();    /* 调度器一旦起来就回不到这里 */

    for (;;) { }
}