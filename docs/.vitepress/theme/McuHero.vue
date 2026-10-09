<script setup lang="ts">
import { ref, onMounted } from 'vue'

const particles = ref<Array<{ id: number; x: number; y: number; size: number; delay: number }>>([])

onMounted(() => {
  particles.value = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    delay: Math.random() * 5,
  }))
})
</script>

<template>
  <div class="mcu-hero">
    <div class="mcu-hero-bg">
      <div class="mcu-hero-grid"></div>
      <div class="mcu-hero-particles">
        <span
          v-for="p in particles"
          :key="p.id"
          class="mcu-particle"
          :style="{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDelay: `${p.delay}s`,
          }"
        ></span>
      </div>
    </div>

    <div class="mcu-hero-content">
      <div class="mcu-hero-badge">
        <span class="mcu-badge-dot"></span>
        <span>开源 MCU 教程 · 80 章 · 97 动画</span>
      </div>

      <h1 class="mcu-hero-title">
        <span class="mcu-title-line">通往</span>
        <span class="mcu-title-accent">单片机</span>
        <span class="mcu-title-line">之路</span>
      </h1>

      <p class="mcu-hero-subtitle">
        从寄存器到实时系统，用动画和实验点亮嵌入式技能树
      </p>

      <div class="mcu-hero-stats">
        <div class="mcu-stat">
          <span class="mcu-stat-num">80</span>
          <span class="mcu-stat-label">章节</span>
        </div>
        <div class="mcu-stat-divider"></div>
        <div class="mcu-stat">
          <span class="mcu-stat-num">97</span>
          <span class="mcu-stat-label">动画</span>
        </div>
        <div class="mcu-stat-divider"></div>
        <div class="mcu-stat">
          <span class="mcu-stat-num">41</span>
          <span class="mcu-stat-label">工程</span>
        </div>
      </div>

      <div class="mcu-hero-actions">
        <a href="/guide/" class="mcu-btn mcu-btn-primary">
          <span>开始学习</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 12L10 8L6 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </a>
        <a href="https://github.com/zhuguang-ZFG/mcu" class="mcu-btn mcu-btn-secondary" target="_blank">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          <span>GitHub</span>
        </a>
      </div>
    </div>

    <div class="mcu-hero-chip">
      <svg viewBox="0 0 200 200" class="mcu-chip-svg">
        <defs>
          <linearGradient id="chipGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#3451b2;stop-opacity:0.8" />
            <stop offset="100%" style="stop-color:#3eaf7c;stop-opacity:0.6" />
          </linearGradient>
        </defs>
        <rect x="50" y="50" width="100" height="100" rx="8" fill="url(#chipGrad)" class="mcu-chip-body"/>
        <g class="mcu-chip-pins">
          <rect x="40" y="60" width="10" height="3" rx="1" fill="#3451b2"/>
          <rect x="40" y="75" width="10" height="3" rx="1" fill="#3451b2"/>
          <rect x="40" y="90" width="10" height="3" rx="1" fill="#3451b2"/>
          <rect x="40" y="105" width="10" height="3" rx="1" fill="#3451b2"/>
          <rect x="40" y="120" width="10" height="3" rx="1" fill="#3451b2"/>
          <rect x="40" y="135" width="10" height="3" rx="1" fill="#3451b2"/>
          <rect x="150" y="60" width="10" height="3" rx="1" fill="#3451b2"/>
          <rect x="150" y="75" width="10" height="3" rx="1" fill="#3451b2"/>
          <rect x="150" y="90" width="10" height="3" rx="1" fill="#3451b2"/>
          <rect x="150" y="105" width="10" height="3" rx="1" fill="#3451b2"/>
          <rect x="150" y="120" width="10" height="3" rx="1" fill="#3451b2"/>
          <rect x="150" y="135" width="10" height="3" rx="1" fill="#3451b2"/>
          <rect x="60" y="40" width="3" height="10" rx="1" fill="#3451b2"/>
          <rect x="75" y="40" width="3" height="10" rx="1" fill="#3451b2"/>
          <rect x="90" y="40" width="3" height="10" rx="1" fill="#3451b2"/>
          <rect x="105" y="40" width="3" height="10" rx="1" fill="#3451b2"/>
          <rect x="120" y="40" width="3" height="10" rx="1" fill="#3451b2"/>
          <rect x="135" y="40" width="3" height="10" rx="1" fill="#3451b2"/>
          <rect x="60" y="150" width="3" height="10" rx="1" fill="#3451b2"/>
          <rect x="75" y="150" width="3" height="10" rx="1" fill="#3451b2"/>
          <rect x="90" y="150" width="3" height="10" rx="1" fill="#3451b2"/>
          <rect x="105" y="150" width="3" height="10" rx="1" fill="#3451b2"/>
          <rect x="120" y="150" width="3" height="10" rx="1" fill="#3451b2"/>
          <rect x="135" y="150" width="3" height="10" rx="1" fill="#3451b2"/>
        </g>
        <text x="100" y="105" text-anchor="middle" font-family="monospace" font-size="14" fill="#fff" font-weight="bold">MCU</text>
      </svg>
    </div>
  </div>
</template>

<style scoped>
.mcu-hero {
  position: relative;
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 60px 20px;
}

.mcu-hero-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.mcu-hero-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(52, 81, 178, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(52, 81, 178, 0.03) 1px, transparent 1px);
  background-size: 40px 40px;
  mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
}

:root.dark .mcu-hero-grid {
  background-image:
    linear-gradient(rgba(52, 81, 178, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(52, 81, 178, 0.08) 1px, transparent 1px);
}

.mcu-hero-particles {
  position: absolute;
  inset: 0;
}

.mcu-particle {
  position: absolute;
  background: var(--vp-c-brand-1);
  border-radius: 50%;
  opacity: 0.3;
  animation: mcu-float 10s ease-in-out infinite;
}

@keyframes mcu-float {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.3; }
  50% { transform: translate(20px, -30px) scale(1.5); opacity: 0.6; }
}

.mcu-hero-content {
  position: relative;
  z-index: 1;
  text-align: center;
  max-width: 700px;
}

.mcu-hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 100px;
  font-size: 0.85em;
  color: var(--vp-c-text-2);
  margin-bottom: 24px;
  backdrop-filter: blur(10px);
}

.mcu-badge-dot {
  width: 8px;
  height: 8px;
  background: var(--vp-c-green-1);
  border-radius: 50%;
  animation: mcu-pulse 2s ease-in-out infinite;
}

@keyframes mcu-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}

.mcu-hero-title {
  font-size: clamp(2.5em, 8vw, 4.5em);
  font-weight: 800;
  line-height: 1.1;
  margin: 0 0 20px;
  letter-spacing: -0.02em;
}

.mcu-title-line {
  display: block;
  color: var(--vp-c-text-1);
}

.mcu-title-accent {
  display: block;
  background: linear-gradient(135deg, var(--vp-c-brand-1) 0%, var(--vp-c-green-1) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: mcu-shimmer 3s ease-in-out infinite;
}

@keyframes mcu-shimmer {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.2); }
}

.mcu-hero-subtitle {
  font-size: 1.2em;
  color: var(--vp-c-text-2);
  margin: 0 0 32px;
  line-height: 1.6;
}

.mcu-hero-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  margin-bottom: 40px;
}

.mcu-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.mcu-stat-num {
  font-size: 2em;
  font-weight: 800;
  color: var(--vp-c-brand-1);
  line-height: 1;
}

.mcu-stat-label {
  font-size: 0.85em;
  color: var(--vp-c-text-3);
  margin-top: 4px;
}

.mcu-stat-divider {
  width: 1px;
  height: 40px;
  background: var(--vp-c-divider);
}

.mcu-hero-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
}

.mcu-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 1em;
  text-decoration: none;
  transition: all 0.2s;
  cursor: pointer;
}

.mcu-btn-primary {
  background: var(--vp-c-brand-1);
  color: #fff;
  box-shadow: 0 4px 14px rgba(52, 81, 178, 0.3);
}

.mcu-btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(52, 81, 178, 0.4);
}

.mcu-btn-secondary {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-divider);
}

.mcu-btn-secondary:hover {
  background: var(--vp-c-bg-mute);
  border-color: var(--vp-c-brand-1);
}

.mcu-hero-chip {
  position: absolute;
  right: 5%;
  top: 50%;
  transform: translateY(-50%);
  width: 180px;
  height: 180px;
  opacity: 0.15;
  animation: mcu-chip-float 6s ease-in-out infinite;
}

@keyframes mcu-chip-float {
  0%, 100% { transform: translateY(-50%) rotate(0deg); }
  50% { transform: translateY(-52%) rotate(5deg); }
}

.mcu-chip-svg {
  width: 100%;
  height: 100%;
}

.mcu-chip-body {
  animation: mcu-chip-glow 4s ease-in-out infinite;
}

@keyframes mcu-chip-glow {
  0%, 100% { filter: drop-shadow(0 0 10px rgba(52, 81, 178, 0.3)); }
  50% { filter: drop-shadow(0 0 20px rgba(52, 81, 178, 0.6)); }
}

.mcu-chip-pins rect {
  animation: mcu-pin-pulse 2s ease-in-out infinite;
}

.mcu-chip-pins rect:nth-child(2n) {
  animation-delay: 0.5s;
}

.mcu-chip-pins rect:nth-child(3n) {
  animation-delay: 1s;
}

@keyframes mcu-pin-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

@media (max-width: 768px) {
  .mcu-hero {
    min-height: 70vh;
    padding: 40px 20px;
  }

  .mcu-hero-chip {
    display: none;
  }

  .mcu-hero-stats {
    gap: 16px;
  }

  .mcu-stat-num {
    font-size: 1.5em;
  }

  .mcu-hero-actions {
    flex-direction: column;
  }

  .mcu-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
