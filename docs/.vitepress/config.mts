import { defineConfig } from 'vitepress'

export default defineConfig({
  base: '/mcu/',
  title: '通往单片机之路',
  description: '寄存器级 STM32F407 × ESP32-S3 深度教学：C 语言精髓 · RTOS 双精讲 · 全程实物实验',
  lang: 'zh-CN',
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/mcu/favicon.svg' }]],
  ignoreDeadLinks: false,
  themeConfig: {
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索', resetButtonTitle: '清空搜索' },
          noResultsText: '没有找到相关段落——换个说法再试，名词类问题去「术语速查」页查。',
        },
      },
    },
    nav: [
      { text: '导读', link: '/guide/' },
      { text: 'C 精髓', link: '/c/' },
      { text: '构建运行', link: '/build/' },
      { text: 'STM32', link: '/stm32/' },
      { text: 'RTOS', link: '/rtos/' },
      { text: 'ESP32', link: '/esp32/' },
      { text: 'GD32', link: '/gd32/' },
      { text: '实验', link: '/lab/' },
      {
        text: '资料',
        items: [
          { text: '术语速查', link: '/reference/glossary' },
          { text: '常见问题 FAQ', link: '/reference/faq' },
          { text: '更新日志', link: '/reference/changelog' },
          { text: '关于我们与致谢', link: '/reference/about' },
        ],
      },
    ],
    sidebar: {
      '/guide/': [
        {
          text: '导读',
          items: [
            { text: '这条路怎么走', link: '/guide/' },
            { text: '实物装备清单', link: '/guide/hardware' },
            { text: '手册地图', link: '/guide/manuals' },
          ],
        },
      ],
      '/c/': [
        {
          text: 'C 语言精髓',
          items: [
            { text: '导览', link: '/c/' },
            { text: 'C0 为什么嵌入式 C 是另一种 C', link: '/c/00-c-in-mcu' },
            { text: 'C1 内存模型', link: '/c/01-memory-model' },
            { text: 'C2 指针', link: '/c/02-pointer' },
            { text: 'C3 volatile', link: '/c/03-volatile' },
            { text: 'C4 结构体与 ABI', link: '/c/04-struct-abi' },
            { text: 'C5 函数指针与状态机', link: '/c/05-func-pointer' },
            { text: 'C6 调用约定与栈帧', link: '/c/06-abi-stack' },
            { text: 'C7 UB 与 MISRA-C', link: '/c/07-ub-misra' },
          ],
        },
      ],
      '/build/': [
        {
          text: '构建与运行全过程',
          items: [
            { text: '导览', link: '/build/' },
            { text: 'B0 工具链全景', link: '/build/00-toolchain' },
            { text: 'B1 四步构建', link: '/build/01-four-steps' },
            { text: 'B2 ELF 解剖', link: '/build/02-elf' },
            { text: 'B3 链接脚本', link: '/build/03-linker-script' },
            { text: 'B4 启动过程', link: '/build/04-startup' },
            { text: 'B5 map 与体积', link: '/build/05-map-size' },
            { text: 'B6 烧录与调试', link: '/build/06-flash-debug' },
            { text: 'B7 构建系统', link: '/build/07-build-system' },
          ],
        },
      ],
      '/stm32/': [
        {
          text: 'STM32F407 寄存器主线',
          items: [
            { text: '导览', link: '/stm32/' },
            { text: 'S0 环境搭建', link: '/stm32/00-env' },
            { text: 'S1 架构总览', link: '/stm32/01-arch' },
            { text: 'S2 RCC 时钟树', link: '/stm32/02-rcc-clock' },
            { text: 'S3 GPIO', link: '/stm32/03-gpio' },
            { text: 'S4 NVIC 与 EXTI', link: '/stm32/04-nvic-exti' },
            { text: 'S5 SysTick', link: '/stm32/05-systick' },
            { text: 'S6 定时器 TIM', link: '/stm32/06-tim' },
            { text: 'S7 USART', link: '/stm32/07-usart' },
            { text: 'S8 DMA', link: '/stm32/08-dma' },
            { text: 'S9 ADC', link: '/stm32/09-adc' },
            { text: 'S10 DAC', link: '/stm32/10-dac' },
            { text: 'S11 I2C', link: '/stm32/11-i2c' },
            { text: 'S12 SPI', link: '/stm32/12-spi' },
            { text: 'S13 内部 Flash 与 IAP', link: '/stm32/13-flash-iap' },
            { text: 'S14 低功耗', link: '/stm32/14-pwr' },
            { text: 'S15 SPL 库解剖', link: '/stm32/15-spl-anatomy' },
            { text: 'S16 HardFault 与排错', link: '/stm32/16-debug-hardfault' },
          ],
        },
      ],
      '/rtos/': [
        {
          text: 'RTOS 双精讲',
          items: [
            { text: '导览', link: '/rtos/' },
          ],
        },
        {
          text: 'FreeRTOS 精讲',
          collapsed: false,
          items: [
            { text: 'F0 为什么需要 RTOS', link: '/rtos/freertos/00-why-rtos' },
            { text: 'F1 任务与 TCB', link: '/rtos/freertos/01-task-tcb' },
            { text: 'F2 上下文切换', link: '/rtos/freertos/02-context-switch' },
            { text: 'F3 调度器', link: '/rtos/freertos/03-scheduler' },
            { text: 'F4 队列', link: '/rtos/freertos/04-queue' },
            { text: 'F5 信号量与互斥量', link: '/rtos/freertos/05-sem-mutex' },
            { text: 'F6 通知/事件/软件定时器', link: '/rtos/freertos/06-notify-event-timer' },
            { text: 'F7 内存管理', link: '/rtos/freertos/07-heap' },
            { text: 'F8 移植到霸天虎', link: '/rtos/freertos/08-port-f407' },
          ],
        },
        {
          text: 'RT-Thread 精讲',
          collapsed: false,
          items: [
            { text: 'R0 架构与对象模型', link: '/rtos/rtthread/00-arch' },
            { text: 'R1 线程与调度', link: '/rtos/rtthread/01-thread-sched' },
            { text: 'R2 IPC 全家桶', link: '/rtos/rtthread/02-ipc' },
            { text: 'R3 内存管理', link: '/rtos/rtthread/03-mem' },
            { text: 'R4 设备框架', link: '/rtos/rtthread/04-device' },
            { text: 'R5 finsh 控制台', link: '/rtos/rtthread/05-finsh' },
            { text: 'R6 Env 与 menuconfig', link: '/rtos/rtthread/06-env-menuconfig' },
            { text: 'R7 移植到霸天虎', link: '/rtos/rtthread/07-port-f407' },
          ],
        },
        {
          text: '对照与选型',
          items: [
            { text: '对比 0 双实现对照', link: '/rtos/compare/00-side-by-side' },
            { text: '对比 1 选型决策树', link: '/rtos/compare/01-choose' },
          ],
        },
      ],
      '/esp32/': [
        {
          text: 'ESP32-S3 + ESP-IDF',
          items: [
            { text: '导览', link: '/esp32/' },
            { text: 'P0 环境搭建', link: '/esp32/00-env' },
            { text: 'P1 架构与启动', link: '/esp32/01-arch-boot' },
            { text: 'P2 GPIO 与引脚矩阵', link: '/esp32/02-gpio-matrix' },
            { text: 'P3 IDF 工程解剖', link: '/esp32/03-idf-anatomy' },
            { text: 'P4 中断与双核', link: '/esp32/04-irq-dualcore' },
            { text: 'P5 UART 驱动解析', link: '/esp32/05-uart-driver' },
            { text: 'P6 SPI/I2C 驱动框架', link: '/esp32/06-spi-i2c-driver' },
            { text: 'P7 定时器与 LEDC', link: '/esp32/07-timer-ledc' },
            { text: 'P8 Wi-Fi 精髓', link: '/esp32/08-wifi' },
            { text: 'P9 蓝牙与 ESP-NOW', link: '/esp32/09-bt-espnow' },
            { text: 'P10 Flash/分区/OTA', link: '/esp32/10-flash-nvs-ota' },
            { text: 'P11 低功耗', link: '/esp32/11-lowpower' },
            { text: 'P12 音频链路', link: '/esp32/12-audio-path' },
          ],
        },
      ],
      '/gd32/': [
        {
          text: 'GD32 双系路线',
          items: [
            { text: '导览（G 篇 ARM / V 篇 RISC-V）', link: '/gd32/' },
            { text: 'G1 RCU 时钟树', link: '/gd32/01-rcu-clock' },
          ],
        },
      ],
      '/lab/': [
        {
          text: '实物实验中心',
          items: [
            { text: '实验总览', link: '/lab/' },
            { text: '实验模板', link: '/lab/template' },
            { text: 'E01 点亮 RGB 红灯', link: '/lab/e01-blink' },
            { text: 'E02 抓 UART 帧', link: '/lab/e02-logic-uart' },
            { text: 'E03 示波器看 PWM', link: '/lab/e03-scope-pwm' },
            { text: 'E04 优先级反转复现', link: '/lab/e04-priority-inversion' },
            { text: 'E05 I2C 抓包读 EEPROM', link: '/lab/e05-i2c-eeprom' },
            { text: 'E06 低功耗电流实测', link: '/lab/e06-lowpower-current' },
            { text: 'E07 S3 姿态传感器', link: '/lab/e07-qmi8658' },
            { text: 'E08 S3 音频放音', link: '/lab/e08-audio-play' },
          ],
        },
      ],
      '/reference/': [
        {
          text: '资料',
          items: [
            { text: '术语速查', link: '/reference/glossary' },
            { text: '常见问题 FAQ', link: '/reference/faq' },
            { text: '更新日志', link: '/reference/changelog' },
            { text: '关于我们与致谢', link: '/reference/about' },
          ],
        },
      ],
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/zhuguang-ZFG/mcu' }],
    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一篇', next: '下一篇' },
    editLink: { pattern: 'https://github.com/zhuguang-ZFG/mcu/edit/main/docs/:path', text: '在 GitHub 上编辑此页' },
    lastUpdated: { text: '最后更新' },
  },
})
