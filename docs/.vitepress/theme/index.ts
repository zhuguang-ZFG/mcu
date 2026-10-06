import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import VideoEmbed from './VideoEmbed.vue'
import LearningMap from './LearningMap.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('VideoEmbed', VideoEmbed)
    app.component('LearningMap', LearningMap)
  },
} satisfies Theme
