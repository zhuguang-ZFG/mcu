import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import Layout from './Layout.vue'
import VideoEmbed from './VideoEmbed.vue'
import LearningMap from './LearningMap.vue'
import AnimFigure from './AnimFigure.vue'
import LabStatus from './LabStatus.vue'
import LabOverview from './LabOverview.vue'
import RegisterExplorer from './RegisterExplorer.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('VideoEmbed', VideoEmbed)
    app.component('LearningMap', LearningMap)
    app.component('AnimFigure', AnimFigure)
    app.component('LabStatus', LabStatus)
    app.component('LabOverview', LabOverview)
    app.component('RegisterExplorer', RegisterExplorer)
  },
} satisfies Theme
