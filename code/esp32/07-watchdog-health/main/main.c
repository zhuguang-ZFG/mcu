#include "../../../common/reliability/protocol.h"
#include "../../../common/reliability/transport.h"
#include "../../../common/reliability/service.h"
#include "../../../common/reliability/health.h"
#include "../../../common/reliability/record.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "driver/uart.h"
#include "driver/gpio.h"
#include "esp_task_wdt.h"
#include "esp_timer.h"
#include "esp_system.h"      /* esp_reset_reason()：v5.5 里住在 esp_system.h（无独立 esp_reset_reason.h） */

#define UART_NUM UART_NUM_1
#define UART_TX_PIN GPIO_NUM_10
#define UART_RX_PIN GPIO_NUM_11
#define LED_PIN GPIO_NUM_2

/* Global service state */
device_service_t g_service;
health_t g_health;
health_supervisor_t g_supervisor;

/* UART ring buffer */
#define RX_RING_SIZE 1024
uint8_t g_rx_ring[RX_RING_SIZE];
volatile uint16_t g_rx_head = 0;
volatile uint16_t g_rx_tail = 0;

/* Task WDT user handle */
esp_task_wdt_user_handle_t g_health_user = NULL;

/* LED heartbeat */
void led_task(void *pvParameters) {
    gpio_set_direction(LED_PIN, GPIO_MODE_OUTPUT);
    while (1) {
        gpio_set_level(LED_PIN, 1);
        vTaskDelay(pdMS_TO_TICKS(500));
        gpio_set_level(LED_PIN, 0);
        vTaskDelay(pdMS_TO_TICKS(500));
    }
}

/* UART event task */
void uart_task(void *pvParameters) {
    uart_config_t uart_config = {
        .baud_rate = 115200,
        .data_bits = UART_DATA_8_BITS,
        .parity = UART_PARITY_DISABLE,
        .stop_bits = UART_STOP_BITS_1,
        .flow_ctrl = UART_HW_FLOWCTRL_DISABLE,
        .source_clk = UART_SCLK_APB,
    };
    uart_driver_install(UART_NUM, RX_RING_SIZE, 0, 0, NULL, 0);
    uart_param_config(UART_NUM, &uart_config);
    uart_set_pin(UART_NUM, UART_TX_PIN, UART_RX_PIN, UART_PIN_NO_CHANGE, UART_PIN_NO_CHANGE);

    uint8_t buffer[128];
    while (1) {
        int len = uart_read_bytes(UART_NUM, buffer, sizeof(buffer), pdMS_TO_TICKS(10));
        if (len > 0) {
            for (int i = 0; i < len; i++) {
                device_service_feed(&g_service, buffer[i], esp_timer_get_time() / 1000);
            }
        }
        vTaskDelay(pdMS_TO_TICKS(1));
    }
}

/* Health task */
void health_task(void *pvParameters) {
    uint32_t deadlines[8] = {500, 500, 0, 0, 0, 0, 0, 0};
    health_init(&g_health, 3, deadlines, 1000, esp_timer_get_time() / 1000);

    while (1) {
        vTaskDelay(pdMS_TO_TICKS(50));
        uint32_t now = esp_timer_get_time() / 1000;
        health_result_t result = health_evaluate(&g_health, now);
        if (!health_supervise(&g_supervisor, result)) {
            esp_task_wdt_reset_user(g_health_user);
        }
        /* Update service state */
        g_service.required = (uint8_t)(result.overdue_mask & 0xFF);
        g_service.overdue = (uint8_t)(result.overdue_mask >> 8);
        g_service.flags = (result.in_grace ? 1 : 0) | (g_supervisor.restart_latched ? 2 : 0);
    }
}

/* Fault injection */
void test_fault_fn(void *user, uint8_t fault, uint8_t task) {
    if (fault == 1) {
        /* Pause health task progress */
        vTaskSuspend(xTaskGetHandle("Health"));
    } else if (fault == 2) {
        /* Stop feeding health user */
        esp_task_wdt_delete_user(g_health_user);
    }
}

/* Main */
void app_main(void) {
    /* Initialize service */
    device_service_init(&g_service, 2, esp_reset_reason(), true, test_fault_fn, NULL);

    /* Initialize TWDT */
    esp_task_wdt_config_t twdt_config = {
        .timeout_ms = 2000,
        .idle_core_mask = (1 << portNUM_PROCESSORS) - 1,
        .trigger_panic = true,
    };
    esp_task_wdt_init(&twdt_config);
    esp_task_wdt_add_user("Health", &g_health_user);

    /* Create tasks */
    xTaskCreate(led_task, "LED", 1024, NULL, 1, NULL);
    xTaskCreate(uart_task, "UART", 2048, NULL, 2, NULL);
    xTaskCreate(health_task, "Health", 2048, NULL, 3, NULL);
}
