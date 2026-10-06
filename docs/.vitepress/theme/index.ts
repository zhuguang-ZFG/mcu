import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import VideoEmbed from './VideoEmbed.vue'
import LearningMap from './LearningMap.vue'
import AnimFigure from './AnimFigure.vue'
import LabStatus from './LabStatus.vue'
import LabOverview from './LabOverview.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('VideoEmbed', VideoEmbed)
    app.component('LearningMap', LearningMap)
    app.component('AnimFigure', AnimFigure)
    app.component('LabStatus', LabStatus)
    app.component('LabOverview', LabOverview)
  },
} satisfies Theme
