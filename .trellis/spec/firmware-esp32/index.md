# firmware-esp32 规范

`code/esp32/` 下的 ESP-IDF 工程（基准：IDF v5.5.x + 立创实战派 S3，N16R8）。

## 工程结构

照 `code/esp32/00-hello/`：

```
<demo>/
├── CMakeLists.txt          # cmake_minimum_required + include(project.cmake) + project()
├── main/
│   ├── CMakeLists.txt      # idf_component_register(SRCS ... INCLUDE_DIRS "")
│   └── <demo>_main.c       # app_main，逐行注释
└── （sdkconfig 为构建产物，不进 git；差异配置写 sdkconfig.defaults）
```

## 纪律

- `set-target esp32s3` 永远是第一步（换 target 会重置 sdkconfig）；
- 新组件显式声明依赖：`REQUIRES`（公开）/`PRIV_REQUIRES`（私有），不依赖间接拉入；
- ISR 及其调用链加 `IRAM_ATTR`；ISR 里禁 printf/malloc/Flash 写（详见 `docs/esp32/04-irq-dualcore.md`）；
- 双核共享数据用 portMUX 自旋锁或原子内建，**禁裸 volatile 跨核**；
- 引脚号/外设 GPIO 分配一律以立创 wiki 原理图为准并在注释注明出处，禁止编造；
- Kconfig 选项进组件自带 `Kconfig` 文件；配置改动走 menuconfig，不手改 sdkconfig。

## 验证

```bash
idf.py set-target esp32s3 && idf.py build     # 必须零错误；有板时 idf.py -p COMx flash monitor
```

- 无板环境：build 通过 + `idf.py size` 记录体积；
- 未上板验证的在工程 README 标注"待上板实测"。

## 可复现检查

CI 使用 `build/ci` 独立 sdkconfig，显式 `set-target esp32s3`；验收读取 project_description.json 的 target，不以旧 build 缓存证明芯片正确。依赖组件固定版本，新音频工程提交 dependencies.lock。PCA9557 bit1 才是本板 PA_EN，不是 ESP32 GPIO1。GPIO Matrix 换脚必须断开旧输出，禁止在 PSRAM 占用脚做输出实验。工程清单/CI 接口见 [quality-contract](../docs-site/quality-contract.md)。
