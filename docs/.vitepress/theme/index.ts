import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import VideoEmbed from './VideoEmbed.vue'
import LearningMap from './LearningMap.vue'
import AnimFigure from './AnimFigure.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('VideoEmbed', VideoEmbed)
    app.component('LearningMap', LearningMap)
    app.component('AnimFigure', AnimFigure)
  },
} satisfies Theme
