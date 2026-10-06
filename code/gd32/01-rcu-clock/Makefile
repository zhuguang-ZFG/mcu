# Makefile —— gd32/01-rcu-clock（xPack arm-none-eabi-gcc）

TARGET   := gd32-rcu-clock
BUILD    := build
CC       := arm-none-eabi-gcc
OBJCOPY  := arm-none-eabi-objcopy
SIZE     := arm-none-eabi-size
CFLAGS   := -mcpu=cortex-m4 -mthumb -mfpu=fpv4-sp-d16 -mfloat-abi=hard \
            -g3 -O1 -Wall -Wextra -std=c11 -ffreestanding -fno-builtin \
            -DGD32F450
LDSCRIPT := gd32f4xx.ld
LD_FLAGS := -T $(LDSCRIPT) -nostartfiles -Wl,--gc-sections -Wl,-Map=$(BUILD)/$(TARGET).map

SRCS := startup_gd32f4xx.s main.c
OBJS := $(patsubst %,$(BUILD)/%,$(SRCS:.c=.o))
OBJS := $(OBJS:.s=.o)

all: $(BUILD)/$(TARGET).bin

$(BUILD)/%.o: %.c | $(BUILD)
	$(CC) $(CFLAGS) -c $< -o $@

$(BUILD)/%.o: %.s | $(BUILD)
	$(CC) $(CFLAGS) -c $< -o $@

$(BUILD)/$(TARGET).elf: $(OBJS)
	$(CC) $(CFLAGS) $(OBJS) $(LD_FLAGS) -o $@

$(BUILD)/$(TARGET).bin: $(BUILD)/$(TARGET).elf
	$(OBJCOPY) -O binary $< $@
	$(SIZE) $<

$(BUILD):
	mkdir -p $(BUILD)

clean:
	rm -rf $(BUILD)

.PHONY: all clean