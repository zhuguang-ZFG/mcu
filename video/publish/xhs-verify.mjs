// 只读核验：小红书「已发布」列表里有没有给定这些集（默认=所有带 publish.xiaohongshu 块的集）。
// 为什么不用搜索框：2026-10-17 实测它会**偶发返回空结果**（同一前缀换个时刻能命中），不能当判据。
// 为什么不用单滚轮：笔记管理是**虚拟列表**（只渲染可视区约 10 条），PageDown/滚轮/scrollTop 单用都不动——
// 得先 Ctrl+Minus 缩小、再三种滚动齐上，才收得全（当晚 43/43 就是这么收的）。
// 用法：node video/publish/xhs-verify.mjs [--eps=a,b,c]
// 退出码：0=给的每一条都在；1=有缺；2=连不上/页面没开出来。自己的页自己关；缩放还原后再关（origin 级）。
import { chromium } from 'playwright'
import { readFileSync, readdirSync, existsSync } from 'node:fs'

const ROOT = 'D:/Users/mcu'
const RUN = `${ROOT}/.temp/xhs-run`
const arg = (name) => {
  const i = process.argv.findIndex((a) => a === name || a.startsWith(`${name}=`))
  if (i < 0) return null
  const a = process.argv[i]
  return a.includes('=') ? a.slice(a.indexOf('=') + 1) : process.argv[i + 1] ?? null
}
function defaultEps() {
  const eps = []
  for (const d of readdirSync(`${ROOT}/video/episodes`)) {
    const f = `${ROOT}/video/episodes/${d}/episode.json`
    if (!existsSync(f)) continue
    try {
      const j = JSON.parse(readFileSync(f, 'utf8'))
      if (j.publish?.xiaohongshu?.title) eps.push([d, j.publish.xiaohongshu.title])
    } catch {}
  }
  return eps
}
const epsArg = arg('--eps')
const target = epsArg
  ? epsArg.split(',').map((e) => {
      const j = JSON.parse(readFileSync(`${ROOT}/video/episodes/${e}/episode.json`, 'utf8'))
      return [e, j.publish?.xiaohongshu?.title || '(没有 xhs 标题)']
    })
  : defaultEps()
if (!target.length) { console.log('没有可核的集'); process.exit(0) }
console.log(`要核 ${target.length} 条：${target.map(([e]) => e).join(', ')}`)

const b = await chromium.connectOverCDP('http://127.0.0.1:9223').catch(() => null)
if (!b) { console.log('❌ 连不上 9223——先把 xhs-daemon 起起来'); process.exit(2) }
const ctx = b.contexts()[0]
const p = await ctx.newPage()
p.setDefaultTimeout(60_000)
p.on('dialog', (d) => d.accept().catch(() => {}))
try {
  await p.goto('https://creator.xiaohongshu.com/new/note-manager', { waitUntil: 'domcontentloaded' })
  for (let i = 0; i < 40 && !(await p.locator('.note-card__body').count()); i++) await p.waitForTimeout(1000)
  const head = await p.evaluate(() => (document.body.innerText.match(/全部\s*\d+/) || [''])[0])
  const tab = p.locator('text=已发布').first()
  if (await tab.count()) { await tab.click({ timeout: 8000 }).catch(() => {}); await p.waitForTimeout(3500) }
  const tabState = await p.evaluate(() => {
    const t = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && (e.innerText || '').trim() === '已发布')
    return t ? (t.closest('[class*="tab"], li, button')?.className || t.parentElement?.className || '(无类名)').slice(0, 80) : '(找不到标签)'
  })
  console.log(`列表头：${head}；「已发布」标签容器类名：${tabState}`)
  for (let i = 0; i < 4; i++) { await p.keyboard.press('Control+Minus'); await p.waitForTimeout(300) }
  await p.waitForTimeout(1200)
  const seen = new Map()
  let stall = 0
  // 上限给足：44 张时实测 43 张后还剩 1 张在收尾几轮里才渲染出来（stall 太小会漏尾卡并误报）
  for (let round = 0; round < 50 && stall < 10; round++) {
    const cards = await p.evaluate(() => {
      const txt = (s) => (s || '').replace(/\s+/g, ' ').trim()
      return [...document.querySelectorAll('.note-card__body')].map((c) => txt(c.innerText))
    })
    let grew = false
    for (const c of cards) if (c && !seen.has(c)) { seen.set(c, round); grew = true }
    if (!grew) stall++; else stall = 0
    await p.keyboard.press('PageDown')
    await p.mouse.move(700, 600)
    await p.mouse.wheel(0, 1400)
    await p.evaluate(() => {
      let el = document.querySelector('.note-card__body')
      while (el && el.scrollHeight <= el.clientHeight) el = el.parentElement
      if (el) el.scrollTop = el.scrollTop + Math.floor(el.clientHeight * 0.9)
    })
    await p.waitForTimeout(1300)
  }
  const all = [...seen.keys()]
  // 总数是动态的：2026-10-17 深夜实测列表头 43→44→45 边跑边涨（ops 线在并发补发 ch24/ch25）——
  // 所以只记录"收下多少 / 列表头此刻报多少"，**不据此断言漏卡**；结论一律只看目标标题命中与否。
  console.log(`收下 ${all.length} 张卡片；列表头此刻报「${head}」（动态数，收尾渲染与并发写入都会让它对不齐，别当完整性基准）`)
  const miss = []
  for (const [ep, title] of target) {
    const hit = title !== '(没有 xhs 标题)' && all.some((c) => c.includes(title))
    console.log(`${hit ? '✅' : '❌'} ${ep}  ${title}`)
    if (!hit) miss.push(ep)
  }
  console.log(`\n命中 ${target.length - miss.length}/${target.length}${miss.length ? `；未命中：${miss.join(', ')}` : ''}`)
  await p.screenshot({ path: `${RUN}/xhs-verify-published.png` })
  console.log(`截图：${RUN}/xhs-verify-published.png`)
  process.exitCode = miss.length ? 1 : 0
} finally {
  // 缩放是 origin 级的：先把这一页还原回 100% 再关，免得影响共用窗口里别的页
  await p.keyboard.press('Control+0').catch(() => {})
  await p.close().catch(() => {})
}
process.exit(process.exitCode || 0)
