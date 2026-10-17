// 版式基线测量：现有成片版式里，每场的内容到底占满哪一段。
// 用法：node .trellis/tasks/10-16-video-layout-header-fill/research/fill-probe.mjs [epId] [platform]
// 只做只读测量，不写 video/out/，产物落在本目录（baseline-*.json / baseline-*.png）。
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { episodePath, loadEpisode, platformConfig, resolveScenes } from '../../../../video/src/spec.mjs'
import { openBrowser, openStage } from '../../../../video/src/stage.mjs'

const HERE = import.meta.dirname
const epId = process.argv[2] || 'f5-sem-mutex'
const only = process.argv[3]

const ep = loadEpisode(epId)
const browser = await openBrowser()
const rows = []
const shots = []

// 页头/页脚/水印/字幕带/进度杠这些不参与内容高度，量内容时必须排除
for (const platform of ['bilibili', 'douyin']) {
  if (only && only !== platform) continue
  const cfg = platformConfig(ep, platform)
  const scenes = resolveScenes(ep, platform)
  const stage = await openStage(browser, {
    platform,
    size: cfg.size,
    safe: cfg.safe,
    scenes,
    kicker: ep.cover?.kicker || '通往单片机之路',
    badge: ep.badge,
  })
  for (let i = 0; i < scenes.length; i++) {
    const m = await stage.page.evaluate(
      (idx) => {
        window.MCU.setup(idx)
        const body = document.getElementById('body')
        const lay = body.querySelector('.lay')
        const bb = body.getBoundingClientRect()
        const pick = [...lay.children].filter((el) => !el.classList.contains('step'))
        const boxes = pick
          .map((el) => {
            const r = el.getBoundingClientRect()
            if (!r.width || !r.height) return null
            return { cls: el.className.split(' ')[0], top: r.top, bottom: r.bottom, left: r.left, right: r.right }
          })
          .filter(Boolean)
        const topbar = document.querySelector('.topbar').getBoundingClientRect()
        const ticksEl = document.querySelector('.ticks')
        const tcs = getComputedStyle(ticksEl)
        return {
          bodyTop: bb.top,
          bodyBottom: bb.bottom,
          contentTop: boxes.length ? Math.min(...boxes.map((b) => b.top)) : null,
          contentBottom: boxes.length ? Math.max(...boxes.map((b) => b.bottom)) : null,
          boxes,
          topbar: { top: topbar.top, bottom: topbar.bottom, text: document.querySelector('.topbar').textContent },
          ticksVisible: tcs.display !== 'none',
        }
      },
      i,
    )
    const kind = scenes[i].kind
    const band = m.bodyBottom - m.bodyTop
    rows.push({
      platform,
      index: i,
      id: scenes[i].id,
      kind,
      kicker: scenes[i].kicker || null,
      bodyTop: +m.bodyTop.toFixed(1),
      bodyBottom: +m.bodyBottom.toFixed(1),
      contentTop: m.contentTop === null ? null : +m.contentTop.toFixed(1),
      contentBottom: m.contentBottom === null ? null : +m.contentBottom.toFixed(1),
      usedPx: m.contentTop === null ? 0 : +(m.contentBottom - m.contentTop).toFixed(1),
      bandPx: +band.toFixed(1),
      fill: m.contentTop === null ? 0 : +((m.contentBottom - m.contentTop) / band).toFixed(3),
      topbar: m.topbar,
      ticksVisible: m.ticksVisible,
      blocks: m.boxes.map((b) => b.cls),
    })
    // 每种 kind 只留一张代表截图，全量留档会把 research 目录塞成几百 MB
    if (platform === 'bilibili' && !shots.includes(kind)) {
      shots.push(kind)
      const png = await stage.capture(i, 0, null, 0, 1)
      writeFileSync(join(HERE, `baseline-${platform}-${kind}.png`), png)
    }
  }
  await stage.close()
}

await browser.close()
writeFileSync(join(HERE, `baseline-${epId}.json`), JSON.stringify({ epId, episodePath: episodePath(epId), rows }, null, 1))

const byKind = {}
for (const r of rows) {
  const k = `${r.platform}/${r.kind}`
  byKind[k] ??= { n: 0, top: 1e9, bottom: 0, fill: 0, band: r.bandPx }
  const g = byKind[k]
  g.n++
  if (r.contentTop !== null) {
    g.top = Math.min(g.top, r.contentTop)
    g.bottom = Math.max(g.bottom, r.contentBottom)
    g.fill = Math.max(g.fill, r.fill)
  }
}
console.log(`# ${epId} 版式基线（单位 px，y 从画面顶部算）`)
console.log('platform/kind      n   内容上界  内容下界   可用带   单场最大填充')
for (const [k, g] of Object.entries(byKind)) {
  console.log(
    `${k.padEnd(18)} ${String(g.n).padStart(2)}  ${String(Math.round(g.top)).padStart(6)}   ` +
      `${String(Math.round(g.bottom)).padStart(6)}   ${String(Math.round(g.band)).padStart(5)}   ` +
      `${String(Math.round(g.fill * 100)).padStart(4)}%`,
  )
}
