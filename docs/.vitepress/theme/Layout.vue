<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { useData } from 'vitepress'
import AiNotice from './AiNotice.vue'
import McuHero from './McuHero.vue'
import McuFeatures from './McuFeatures.vue'

const { Layout } = DefaultTheme
const { page } = useData()
const isHome = page.value.frontmatter.layout === 'home'
</script>

<template>
  <Layout>
    <template #layout-top>
      <a class="mcu-skip-link" href="#VPContent">跳到正文</a>
    </template>
    <template #home-hero-before v-if="isHome">
      <McuHero />
    </template>
    <template #home-features-before v-if="isHome">
      <McuFeatures />
    </template>
    <template #doc-after>
      <AiNotice />
    </template>
  </Layout>
</template>
