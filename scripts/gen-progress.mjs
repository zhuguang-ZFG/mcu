/**
 * 章节进度事实源生成器：扫描 docs/ 各板块章节的 frontmatter，
 * 产出 docs/.vitepress/data/progress.json 供首页学习地图与统计数字使用。
 *
 * 为什么要有这个脚本：成稿数/动画数/实验数曾经靠手写，结果 README、
 * CONTRIBUTING 与站内三处数字各说各话。数字一律由本脚本从文件算出来。
 *
 * 用法：node scripts/gen-progress.mjs（docs:dev / docs:build 已自动前置执行）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DOCS = path.join(ROOT, 'docs')
const OUT = path.join(DOCS, '.vitepress', 'data', 'progress.json')

const TRACKS = [
  { key: 'c', name: 'C 语言精髓', dir: 'c' },
  { key: 'build', name: '构建与运行全过程', dir: 'build' },
  { key: 'stm32', name: 'STM32F407 寄存器主线', dir: 'stm32' },
  // rtos 三个子路线共用 rtos/index.md 导览，没有各自的板块首页
  { key: 'freertos', name: 'FreeRTOS 精讲', dir: 'rtos/freertos', landing: '/rtos/index.html' },
  { key: 'rtthread', name: 'RT-Thread 精讲', dir: 'rtos/rtthread', landing: '/rtos/index.html' },
  { key: 'compare', name: '双 OS 对照与选型', dir: 'rtos/compare', landing: '/rtos/index.html' },
  { key: 'esp32', name: 'ESP32-S3 + ESP-IDF', dir: 'esp32' },
  { key: 'gd32', name: 'GD32 双系对照', dir: 'gd32' },
  { key: 'lab', name: '实物实验中心', dir: 'lab', prefix: 'e' },
]

const chapterPattern = (t) => (t.prefix ? new RegExp(`^${t.prefix}\\d\\d-`) : /^\d\d-/)

/** 极简 frontmatter 读取：只要顶层 `key: value`，本站章节用不到嵌套结构。 */
function readFrontmatter(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!m) return {}
  const out = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/)
    if (kv && !out[kv[1]]) out[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '')
  }
  return out
}

const warnings = []
const tracks = TRACKS.map((t) => {
  const dir = path.join(DOCS, t.dir)
  const pattern = chapterPattern(t)
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => pattern.test(f) && f.endsWith('.md')) : []
  const chapters = files.map((f) => {
    const fm = readFrontmatter(path.join(dir, f))
    const rel = `${t.dir}/${f.replace(/\.md$/, '')}`
    if (!fm.title) warnings.push(`${rel}: 缺 frontmatter title`)
    if (!fm.status) warnings.push(`${rel}: 缺 frontmatter status（done|building）`)
    if (!fm.difficulty) warnings.push(`${rel}: 缺 frontmatter difficulty（1|2|3）`)
    if (!fm.minutes) warnings.push(`${rel}: 缺 frontmatter minutes`)
    return {
      title: fm.title || f,
      route: `/${rel}.html`,
      status: fm.status === 'done' ? 'done' : 'building',
      difficulty: Number(fm.difficulty) || 0,
      minutes: Number(fm.minutes) || 0,
    }
  })
  const done = chapters.filter((c) => c.status === 'done').length
  return { ...t, chapters, done, total: chapters.length }
})

const listFiles = (dir, filter = () => true) =>
  fs.existsSync(dir) ? fs.readdirSync(dir).filter(filter) : []

const animations = listFiles(path.join(DOCS, 'public', 'anim'), (f) => f.endsWith('.svg')).length
const codeRoot = path.join(ROOT, 'code')
const projects = fs.existsSync(codeRoot)
  ? fs.readdirSync(codeRoot).reduce((n, board) => {
      const p = path.join(codeRoot, board)
      return n + (fs.statSync(p).isDirectory() ? listFiles(p, (f) => fs.statSync(path.join(p, f)).isDirectory()).length : 0)
    }, 0)
  : 0

const chapters = tracks.filter((t) => t.key !== 'lab')
const experiments = tracks.find((t) => t.key === 'lab')
const totals = {
  chapters: chapters.reduce((n, t) => n + t.total, 0),
  chaptersDone: chapters.reduce((n, t) => n + t.done, 0),
  experiments: experiments.total,
  experimentsDone: experiments.done,
  animations,
  projects,
  minutes: chapters.reduce((n, t) => n + t.chapters.filter((c) => c.status === 'done').reduce((s, c) => s + c.minutes, 0), 0),
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify({ totals, tracks }, null, 2) + '\n', 'utf8')

console.log(
  `成稿章节 ${totals.chaptersDone}/${totals.chapters} · 实验 ${totals.experimentsDone}/${totals.experiments} · ` +
    `动画 ${totals.animations} · 示例工程 ${totals.projects}`
)
if (warnings.length) {
  console.warn(`\n⚠️ ${warnings.length} 条元数据告警：`)
  warnings.forEach((w) => console.warn('  - ' + w))
}
