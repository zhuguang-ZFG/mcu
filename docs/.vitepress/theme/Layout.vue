<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #layout-top>
      <a class="mcu-skip-link" href="#VPContent">跳到正文</a>
    </template>
  </Layout>
</template>
