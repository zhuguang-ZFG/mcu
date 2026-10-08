<script setup>
import { onMounted, onUnmounted, ref, nextTick } from 'vue'

// SVG 由 config.mts 的 markdown 规则在构建期内联进来，以字符串 prop 交给 v-html 渲染
// （静态内容，不让 Vue 去 diff 整棵 SVG 子树）；本组件只负责控件：
// 暂停/播放、进度条、放大查看、尊重系统的"减少动效"偏好。
// 配色靠 custom.css 里的 .a-* / .s-* 类（同一处规则完成深浅两套主题）。

const props = defineProps({
  name: { type: String, required: true },
  caption: { type: String, default: '' },
  dur: { type: [String, Number], default: '' },
  markup: { type: String, default: '' },
})

const stage = ref(null)
const lightboxStage = ref(null)
const paused = ref(false)
const reducedMotion = ref(false)
const lightbox = ref(false)

function applyPlayState() {
  const svg = stage.value?.querySelector('svg')
  if (!svg || typeof svg.pauseAnimations !== 'function') return
  if (paused.value) svg.pauseAnimations()
  else svg.unpauseAnimations()
}

function toggle() {
  paused.value = !paused.value
  applyPlayState()
  if (lightbox.value) syncLightbox()
}

// 全屏副本不复制 DOM：用同一份 markup 再渲染一份。SMIL 各自跑，
// 打开时把当前时刻与暂停状态同步过去，保证"减少动效"用户看到的是静止帧。
function openLightbox() {
  lightbox.value = true
  nextTick(syncLightbox)
}

function syncLightbox() {
  const src = stage.value?.querySelector('svg')
  const dst = lightboxStage.value?.querySelector('svg')
  if (!src || !dst || typeof src.getCurrentTime !== 'function') return
  try { dst.setCurrentTime(src.getCurrentTime()) } catch { /* 无碍 */ }
  if (typeof dst.pauseAnimations === 'function') {
    if (paused.value) dst.pauseAnimations()
    else dst.unpauseAnimations()
  }
}

function closeLightbox() {
  lightbox.value = false
}

function onKey(e) {
  if (e.key === 'Escape') closeLightbox()
}

onMounted(() => {
  // 尊重系统偏好但不替用户做决定：默认停在静止帧，点「播放」即可跑起来。
  reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const svg = stage.value?.querySelector('svg')
  if (reducedMotion.value) {
    // 静止帧不能停在 t=0：爬线一笔没画、生长箭头一寸没长，那是一张缺零件的图。
    // 停在末尾——底色、结论字幕都在，波形也已经整条画完了。
    const d = Number(props.dur)
    if (svg && d) svg.setCurrentTime(d * 0.9)
    paused.value = true
  }
  applyPlayState()
  window.addEventListener('keydown', onKey)
})

onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <figure class="anim-figure" :data-anim="name" :class="{ 'is-paused': paused }">
    <div ref="stage" class="anim-figure__stage" v-html="markup" />
    <div class="anim-figure__bar">
      <button
        v-if="dur"
        class="anim-figure__btn"
        type="button"
        :aria-pressed="paused ? 'true' : 'false'"
        @click="toggle"
      >
        {{ paused ? '播放' : '暂停' }}
      </button>
      <span v-if="dur" class="anim-figure__progress" aria-hidden="true">
        <i :style="{ animationDuration: dur + 's' }" />
      </span>
      <span class="anim-figure__meta">
        <template v-if="dur">{{ dur }}s 一轮</template>
        <template v-if="reducedMotion && paused"> · 系统偏好减少动效，已停在静止帧</template>
      </span>
      <button
        v-if="markup"
        class="anim-figure__zoom"
        type="button"
        aria-label="放大查看动画"
        title="放大查看"
        @click="openLightbox"
      >
        放大
      </button>
    </div>
    <figcaption v-if="caption" class="anim-figure__caption">{{ caption }}</figcaption>

    <Teleport to="body">
      <div
        v-if="lightbox"
        class="anim-lightbox"
        role="dialog"
        aria-modal="true"
        aria-label="动画放大查看"
        @click.self="closeLightbox"
      >
        <div class="anim-lightbox__card">
          <button class="anim-lightbox__close" type="button" aria-label="关闭" @click="closeLightbox">✕</button>
          <div ref="lightboxStage" class="anim-figure__stage anim-lightbox__stage" v-html="markup" />
          <div class="anim-figure__bar">
            <button
              v-if="dur"
              class="anim-figure__btn"
              type="button"
              :aria-pressed="paused ? 'true' : 'false'"
              @click="toggle"
            >
              {{ paused ? '播放' : '暂停' }}
            </button>
            <span v-if="dur" class="anim-figure__progress" aria-hidden="true">
              <i :style="{ animationDuration: dur + 's' }" />
            </span>
            <span class="anim-figure__meta">{{ dur }}s 一轮 · Esc 关闭</span>
          </div>
        </div>
      </div>
    </Teleport>
  </figure>
</template>