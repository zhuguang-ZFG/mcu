# firmware-stm32 规范

`code/stm32/` 下的寄存器级工程（基准板：野火 F407 霸天虎，F407ZGT6）。

## 工程结构（每个示例四文件起）

照 `code/stm32/00-blink/`：

| 文件 | 职责 |
|---|---|
| `startup_stm32f407xx.s` | 向量表（16 内核+82 外设，顺序=RM0090 §12.2）+ Reset_Handler（**使能 FPU(CPACR)**→.data 搬运→.bss 清零→跳 main）+ weak 默认中断 |
| `stm32f407xx.ld` | FLASH 1M@0x08000000、RAM 128K@0x20000000、符号界碑（_sidata 等五件套） |
| `main.c` | 业务代码，逐行注释 |
| `Makefile` | arm-none-eabi-gcc，`-mcpu=cortex-m4 -mthumb -mfpu=fpv4-sp-d16 -mfloat-abi=hard`，`-ffunction/data-sections + --gc-sections + -Map` |

## 代码纪律

- 寄存器访问三件套（见 00-blink/main.c）：`volatile uint32_t*`、基址宏+偏移、`1UL << n` 掩码（**禁 int 字面量移位**，防 [C7 UB](../../../docs/c/07-ub-misra.md)）；
- 配置顺序口诀：先时钟（RCC_xxENR）→再模式（MODER/OTYPER/OSPEEDR/PUPDR）→后数据（BSRR）；
- 单比特改写用 BSRR，禁 ODR 读-改-写；
- 每个地址/位在注释给出处（RM0090 章节号或 CMSIS 头文件行）；未核实的一律 `#error 待核对` 或文档注明"以手册为准"，禁止编造；
- 已核实事实清单（CMSIS 核对过）：GPIOF=0x40021400、RCC=0x40023800、AHB1ENR 偏移 0x30、GPIOFEN=bit5、BSRR 偏移 0x18；霸天虎 LED 红 PF6/绿 PF7/蓝 PF8 共阳低电平点亮。

## 验证

```bash
cd code/stm32/<demo> && make          # 必须零警告通过（-Wall -Wextra）
make flash                             # OpenOCD+ST-Link 烧录（有板时）
```

- 无板环境：至少 `arm-none-eabi-gcc` 编译链接通过 + `nm/objdump` 抽查向量表落位 0x08000000。
- 固件未上板验证的，在工程 README 与对应章节页标注"待上板实测"。

## 构建回归

全工程执行 `npm run firmware:check`：检查生成 bin 的初始 SP、Thumb 复位向量与 ELF 符号一致；不能只检查链接成功。FreeRTOS 参数场景产物必须隔离在 `build/scene-N/`，切换参数不依赖手动 clean。详细合同见 [quality-contract](../docs-site/quality-contract.md)。
