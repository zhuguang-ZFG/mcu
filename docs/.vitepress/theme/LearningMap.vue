<script setup lang="ts">
import { withBase } from 'vitepress'
import data from '../data/progress.json'

// 数字来自 scripts/gen-progress.mjs（扫 docs/** 的 frontmatter）。
// 首页与 README 不再手写统计——上一版三处数字各说各话就是这么来的。
const totals = data.totals
const tracks = data.tracks
const readTime = Math.round(totals.minutes / 60)

const difficultyLabel = (level: number) => (level === 1 ? '入门' : level === 2 ? '进阶' : '硬核')
const landing = (track) => withBase(track.landing || `/${track.dir}/index.html`)
</script>

<template>
  <div class="mcu-map">
    <div class="mcu-map__stats">
      <div class="mcu-stat">
        <b>{{ totals.chaptersDone }}<i>/{{ totals.chapters }}</i></b>
        <span>成稿章节</span>
      </div>
      <div class="mcu-stat">
        <b>{{ totals.experimentsDone }}<i>/{{ totals.experiments }}</i></b>
        <span>实验文稿（非实测数）</span>
      </div>
      <div class="mcu-stat">
        <b>{{ totals.animations }}</b>
        <span>机制动画</span>
      </div>
      <div class="mcu-stat">
        <b>{{ totals.projects }}</b>
        <span>示例工程</span>
      </div>
      <div class="mcu-stat">
        <b>≈{{ readTime }}<i> 小时</i></b>
        <span>成稿内容通读</span>
      </div>
    </div>

    <div v-for="track in tracks" :key="track.key" class="mcu-track">
      <div class="mcu-track__head">
        <a class="mcu-track__name" :href="landing(track)">{{ track.name }}</a>
        <span class="mcu-track__count">{{ track.done }}/{{ track.total }} 成稿 · {{ track.built }} 已建档</span>
        <span class="mcu-track__bar">
          <i :style="{ width: (track.total ? (track.done / track.total) * 100 : 0) + '%' }" />
        </span>
      </div>
      <ul class="mcu-chips">
        <li v-for="ch in track.chapters" :key="ch.id">
          <component :is="ch.route ? 'a' : 'span'"
            class="mcu-chip"
            :class="ch.status === 'done' ? 'is-done' : 'is-building'"
            :href="ch.route ? withBase(ch.route) : undefined"
            :title="
              ch.status === 'done'
                ? `${difficultyLabel(ch.difficulty)} · 约 ${ch.minutes} 分钟`
                : '骨架页：结构与目标已定，正文待成稿'
            "
          >
            {{ ch.title }}
            <em v-if="ch.status === 'done'">{{ difficultyLabel(ch.difficulty) }} {{ ch.minutes }}′</em>
            <em v-else>{{ ch.route ? '建设中' : '规划中' }}</em>
          </component>
        </li>
      </ul>
    </div>
  </div>
</template>
