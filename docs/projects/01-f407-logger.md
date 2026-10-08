---
title: J1 STM32F407 传感器记录器
status: done
difficulty: 3
minutes: 60
code_status: ready
hardware_status: pending
code_note: 真实外设驱动与完整运行路径已提供；物理板卡结果待测。
projects: ["stm32-07-sensor-logger"]
---

# J1 STM32F407 传感器记录器

> 🎯 数据能打印一次不难；让它在传感器失联、队列积压和配置写入中断后仍有明确状态，才是一套完整记录器。

## 本章精髓

采集、滤波、队列、通信、配置保存与监督各有一个职责。两平台共享协议和纯C核心，驱动差异留在port适配层。健康判据是完成有界工作，传感器错误不自动等于任务卡死。

## 学习目标

- 能从定时输入跟踪一条记录到64字节协议负载和主机CSV。
- 能解释APPLIED与SAVED、原始与滤波、有效与无效数据的差别。
- 能注入坏帧、暂停与存储中断，并用计数和复位原因判断结果。

## 先修

必需：[C8协议](../c/08-framed-protocol.md)、[S17看门狗](../stm32/17-watchdog-reset.md)、[P13健康监督](../esp32/13-watchdog-health.md)；板卡路线补 [S9 ADC](../stm32/09-adc.md) 或 [P6 I2C](../esp32/06-spi-i2c-driver.md)。另一平台作为并行对照。

## 工程信息

<LabStatus />

## 配置与接线

PA0 为 ADC1_IN0：外接电位器中间脚，另外两端接3.3V和GND；先移除旧 PA6→PA0 测频跳线。PB6/PB7 接 AT24C02 SCL/SDA、各4.7k上拉至3.3V，A0–A2和WP接地。模块256字节全部作为配置双槽使用，会覆盖旧EEPROM实验数据。USART1 PA9 TX/PA10 RX接3.3V USB-TTL。

F407基准为复位HSI16+FreeRTOS V11.1.0；S3为IDF5.5.2。共地、TX/RX交叉，COMx换实际端口，绝不把5V信号直接接入3.3V GPIO。

## 先跑起来

在已激活工具链环境执行：

~~~sh
cd code/stm32/07-sensor-logger
make MODE=0 FAULTS=0
make MODE=0 FAULTS=0 flash
~~~

随后回仓库根，在主机执行：

~~~sh
python3 -m pip install -r scripts/device-console-requirements.txt
python3 scripts/device-console.py info --port COMx
python3 scripts/device-console.py status --port COMx
python3 scripts/device-console.py configure --period 200 --filter-shift 2 --port COMx
python3 scripts/device-console.py save --port COMx
python3 scripts/device-console.py record --seconds 10 --output samples.csv --port COMx
python3 scripts/device-console.py stop --port COMx
python3 scripts/device-console.py start --port COMx
~~~

record写入新的CSV文件；请使用新的输出路径，避免覆盖之前的数据。默认周期100ms；period允许100–1000ms且为10ms倍数，filter-shift允许0–6，0为直通。configure只改变运行配置，save成功才持久化；旧generation的在途采样会丢弃计数，防止误标新配置。

## 四层实现

| 层 | 实际职责 | 验证 |
|---|---|---|
| 外设适配 | ADC或I2C、串口、存储、硬件watchdog | 平台编译与待上板日志 |
| 公共核心 | 滤波、配置镜像、16槽样本队列 | 生产C函数的宿主断言 |
| RTOS运行层 | 采样/通信/监督任务，短时状态互斥 | 故障注入和期限预算 |
| 主机 | 独立编解码、序号匹配、CSV | C/Python交叉向量 |

## 定时采样与滤波

TIM2 TRGO 以毫秒分频定时触发 ADC1，DMA2 Stream0 Channel0 使用两个半字缓冲，IRQ56发通知唤醒采样任务。IRQ优先级6，满足本项目MAX_SYSCALL=5的限制；USART1使用DMA2 Stream5，不共用流。原始数据是12位ADC码值，不能未测VDDA就声称是校准电压。

默认整数IIR每次走向新值的1/4，使用64位中间差值避免溢出；整数舍入会产生小死区，滤波延迟不是零。有效位清除的通道不更新滤波，恢复后第一样本重新初始化。STOP停止采样服务，但通信和监督仍执行，不应该触发看门狗。

## 协议与缓冲

SAMPLE固定64字节：sequence/u32、timestamp_ms/u32、generation/u32、sensor_type/u8、valid_mask/u8、status/u16、raw[6]/i32、filtered[6]/i32，全部LE。ADC仅bit0有效；IMU最多六位有效。INFO给原码比例，STATUS的TLV给运行配置、保存代次、丢弃/传感器/存储错误和队列高水位。

样本队列16槽，满则丢新记录并计数。TX另有4帧槽和100ms发送期限，部分帧失败后先发零同步。无硬件流控的UART不能确认对端真正接收，也不能可靠检测接收线断开；主机用序号发现缺口，不承诺无限离线缓存。

## 配置保存与恢复

AT24C02 两个128字节槽。写目标槽前使提交标记无效；按8字节页边界写前127字节，回读校验后最后写提交标记。旧槽在整个过程中保留，启动挑选最新有效generation。每个写步骤的中断都用生产存储逻辑测试；硬件断电/时序仍待实测。

配置代次用有界模序号比较；不同schema不能直接按新结构解释。保存发生在状态锁之外，采样优先级高于通信，避免慢存储长期阻塞采样。重复保存相同代次不额外写入。

## 健康与故障实验

采样服务期限2500ms、通信1500ms，监督每50ms评估；硬件watchdog名义2s。无流量、已STOP、传感器返回错误但工作循环仍前进，都不属于卡死。首次超时锁存停喂狗，故障记录只辅助暖复位诊断，不能代替真实上板观测。

测试构建才开放以下显式命令，普通固件返回UNSUPPORTED：

| 输入 | 预期逻辑结果（非实测） |
|---|---|
| fault 1 / task 0或1 | 指定任务停止上报，随后watchdog复位 |
| fault 2 | 监督停止喂狗，注册的watchdog仍保留 |
| fault 3 | 1秒模拟传感器失联，有效位清零，系统保持健康 |
| fault 4 | TX暂停2秒，队列积压/丢弃可观察，随后同步恢复 |

命令示例：`python3 scripts/device-console.py fault --fault 3 --port COMx`。应答入队后200ms执行，不自动重试故障。F407以FAULTS=1构建；S3用独立sdkconfig合并sdkconfig.defaults.faults。断电配置试验先使用专用存储，不对有重要数据的模块做实验。

## 自测与排查

1. 为什么CRC正确也不能信任无效位通道？CRC只说明报文字节没被检测出损坏，不保证传感器成功。
2. 为什么保存时不持有采样状态锁？外设可能等待擦写，锁会把本可继续工作的采样任务拖住。
3. 什么情况下重启后仍是旧参数？只configure未save，或者保存失败/掉电，旧有效配置应保留。

无数据先查START状态和端口/交叉接线，再查STATUS有效性与错误计数；无响应查看RX错误和TX丢弃；意外复位检查reset_reason、过期mask、调试器冻结设置。不要先加长看门狗掩盖卡死。

## 附录：完整运行路径

公共任务层：

<<< ../../code/common/logger/runtime.c

平台适配：

<<< ../../code/stm32/platform/logger_port.c

## 你做到了

可追踪一条记录从外设到CSV，能分清配置应用、保存和恢复，也能把故障从静默错误变成明确状态。上板记录请注明板版本、固件提交、接线、输入和原始日志，本页当前仍为待实测。
