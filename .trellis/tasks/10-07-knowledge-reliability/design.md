# 协议与健康监测设计（权威合同）

## 纯逻辑与适配

code/common/reliability 放置 protocol.h/.c、health.h/.c、时间 helper 及宿主测试入口。芯片代码提供字节流和单调 uint32_t 毫秒时钟，不把寄存器/RTOS 头引入公共模块。新增公共目录作为 host-probe 登记，CI 调用其真实测试。

两板均使用独立 UART 数据口，日志留在既有调试口或另一明确配置的接口。F407 若共享同一物理 UART，协议工程禁 stdout 文本混入，调试走 SWD；S3 数据可用既有扩展口 UART1 GPIO10/11，日志在默认控制台。最终引脚在实现前核对。

## 帧格式 v1

线上：COBS 编码后的 raw frame + 0x00 分隔符。
raw frame：version:u8=1、type:u8、sequence:u16 LE、payload_length:u16 LE、payload[0..64]、CRC:u16 LE。
CRC-16/CCITT-FALSE 覆盖除 CRC 本身之外的 raw bytes：poly=0x1021，init=0xffff，refin/refout=false，xorout=0；标准检查串 123456789 应得 0x29b1。
raw 最大 72 字节，COBS 含分隔符最大 74 字节；接收容量以明确常量计算并断言，不能用不受信任 length 分配内存。

间字节超时默认 100ms，可通过初始化参数注入。任意 feed 分块应产生相同有效帧序列。空分隔符忽略；坏 COBS/CRC/version/length 丢弃并递增对应错误计数；超长帧丢弃到下一个分隔符。解析器不能扫描越界或永久等待缺失字节。

sequence 16 位模回绕；主机单次仅挂起一个命令，响应回显序号。协议不宣称身份认证。命令使用设置目标状态而非 toggle；重发 SET/SAVE 同内容幂等，不宣称跨设备复位的 exactly-once。

type 空间固定：0x01 INFO、0x02 STATUS、0x03 START、0x04 STOP、0x05 SET_CONFIG、0x06 SAVE_CONFIG、0x10 SAMPLE、0x7f TEST_FAULT；响应通过 type|0x80，payload 第一个字节为状态码。TEST_FAULT 仅显式测试构建开放，正常构建返回不支持。具体业务 payload 由 capstone design 拥有，基础工程提供 INFO/STATUS 的最小命令路径。64 字节上限包含响应状态字节，不能将 64 字节请求不加检查地再附状态回传。

## 并发与缓冲

ISR 不做阻塞发送；SPSC 发布规则明确索引原子性和内存顺序，或采用平台支持的 ISR-safe 队列。DMA 适配沿用阶段 1 经验证的消费模型。仅报告成功接收的帧，不用无符号位置差掩盖漏圈。

## 健康监测

公共接口：health_init(health_t *ctx, uint32_t required_mask, const uint32_t deadline_ms[8], uint32_t startup_grace_ms, uint32_t now_ms)；bool health_progress(health_t *ctx, uint8_t task_id, uint32_t now_ms)；health_result_t health_evaluate(const health_t *ctx, uint32_t now_ms)。固定最多 8 个任务，结果包含 may_feed、overdue_mask；非法任务 ID 拒绝，时间范围要求小于半个 uint32_t 模周期。
纯 C 模块不自带锁：调用者必须串行化读写，平台用短临界区或消息把任务进展交给 supervisor，不能在另一核并发修改结构却假定普通读取是一致快照。测试直接驱动这些入口。
每个关键任务有最后前进时刻和期限；只在 required_mask 全部按期前进时允许 supervisor 喂狗。普通心跳不能由无关 ISR 替代。

F407：IWDG 独立时钟复位作为主例，说明 LSI 容差；WWDG 展示过早/过晚服务窗口。S3：按 IDF 5.5.2 处理 TWDT 已初始化/订阅/配置，说明 IWDT 保护中断阻塞。debug freeze/暂停调试造成的行为必须独立记录。

复位后先读硬件原因再清标志；故障细节可在受控保留 RAM/备份域保存，带 magic/version/CRC，并区分暖复位保留与断电丢失。不可把未写入成功的数据说成掉电持久化。

## 主机工具与兼容

新增教材落点：docs/stm32/17-watchdog-reset.md（S17）、docs/esp32/13-watchdog-health.md（P13）、docs/c/08-framed-protocol.md（C8）。沿用现有板块导览与编号，按课程计划和工程清单同步登记，不另造同题页面。

scripts/device-console.py 支持串口参数、帧解析、命令、CSV 日志和回归向量。串口依赖单独声明版本，测试核心 codec 不强依赖设备。
协议 wire version 不静默变化；向量、文档和两板代码同步升级。旧入门示例保持可单独运行。

## 失败与回退

CRC/协议失败只丢帧，不自动重启整板；任务卡死才进入 watchdog 路径。测试构建的故障入口默认关闭，防止普通学习运行无意卡死。公共 API 变更必须同时更新两平台与 CLI。
