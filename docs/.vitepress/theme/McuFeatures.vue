<script setup lang="ts">
const features = [
  {
    icon: '📖',
    title: '80 章体系化教程',
    desc: '从 C 语言精髓到 RT-Thread 移植，完整覆盖嵌入式开发技能树',
    gradient: 'linear-gradient(135deg, #3451b2 0%, #5b6abf 100%)',
  },
  {
    icon: '🎬',
    title: '97 张 SVG 动画',
    desc: '寄存器位操作、时钟树、调度算法……抽象概念可视化',
    gradient: 'linear-gradient(135deg, #3eaf7c 0%, #4fc08d 100%)',
  },
  {
    icon: '🔧',
    title: '41 个可编译工程',
    desc: 'STM32 / GD32 / ESP32 三平台，每章配套固件代码',
    gradient: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
  },
  {
    icon: '🧪',
    title: '8 个硬件实验',
    desc: '从 Blink 到示波器实测，理论动手闭环',
    gradient: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
  },
]
</script>

<template>
  <div class="mcu-features">
    <div
      v-for="(f, i) in features"
      :key="i"
      class="mcu-feature-card"
      :style="{ '--card-gradient': f.gradient }"
    >
      <div class="mcu-feature-icon">{{ f.icon }}</div>
      <h3 class="mcu-feature-title">{{ f.title }}</h3>
      <p class="mcu-feature-desc">{{ f.desc }}</p>
      <div class="mcu-feature-glow"></div>
    </div>
  </div>
</template>

<style scoped>
.mcu-features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  padding: 40px 20px;
  max-width: 1000px;
  margin: 0 auto;
}

.mcu-feature-card {
  position: relative;
  padding: 28px 24px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 16px;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.mcu-feature-card:hover {
  transform: translateY(-4px);
  border-color: transparent;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.1);
}

:root.dark .mcu-feature-card:hover {
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
}

.mcu-feature-glow {
  position: absolute;
  inset: 0;
  background: var(--card-gradient);
  opacity: 0;
  transition: opacity 0.3s;
  z-index: 0;
}

.mcu-feature-card:hover .mcu-feature-glow {
  opacity: 0.05;
}

.mcu-feature-icon {
  position: relative;
  z-index: 1;
  font-size: 2.5em;
  margin-bottom: 16px;
  display: inline-block;
  animation: mcu-icon-bounce 2s ease-in-out infinite;
  animation-play-state: paused;
}

.mcu-feature-card:hover .mcu-feature-icon {
  animation-play-state: running;
}

@keyframes mcu-icon-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

.mcu-feature-title {
  position: relative;
  z-index: 1;
  font-size: 1.15em;
  font-weight: 700;
  color: var(--vp-c-text-1);
  margin: 0 0 8px;
}

.mcu-feature-desc {
  position: relative;
  z-index: 1;
  font-size: 0.9em;
  color: var(--vp-c-text-2);
  line-height: 1.6;
  margin: 0;
}

@media (max-width: 640px) {
  .mcu-features {
    grid-template-columns: 1fr;
    padding: 20px;
  }
}
</style>
