import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fmtClock, log } from './util.mjs'

const FONT = "'Microsoft YaHei','PingFang SC','Noto Sans SC','Segoe UI',system-ui,sans-serif"

// 封面走 HTML 截图而不是 PIL：和正片同一套字体回退、同一套配色，
// 不会出现"封面有字、正片豆腐块"这种两边字体栈不一致的坑。
function coverHtml({ kicker, line1, line2, tag, size }) {
  const [w, h] = size
  const u = h / 100
  const big = line2 ? 13 : 15
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:${w}px;height:${h}px;font-family:${FONT};color:#e6eaf2;overflow:hidden;
  background:radial-gradient(120% 110% at 22% 0%,#131c33 0%,#0b1220 58%,#060a13 100%)}
.pad{position:absolute;inset:0;padding:${u * 9}px ${u * 8}px;display:flex;flex-direction:column;justify-content:space-between}
.kicker{font-size:${u * 3.1}px;letter-spacing:.22em;color:#8ab4ff;font-weight:700}
.l1{font-size:${u * big}px;line-height:1.14;font-weight:800;letter-spacing:-.02em}
.l2{font-size:${u * big}px;line-height:1.14;font-weight:800;letter-spacing:-.02em;color:#f0b45c}
.foot{display:flex;align-items:center;gap:${u * 2}px;font-size:${u * 2.6}px;color:#a9b3c1}
.chip{border:1px solid #3b4453;border-radius:999px;padding:${u * .8}px ${u * 2.4}px;color:#8ab4ff;font-weight:600}
.bar{height:${u * 1.1}px;width:${u * 16}px;background:linear-gradient(90deg,#8ab4ff,#4fd196);border-radius:999px}
.glow{position:absolute;right:-8%;top:-14%;width:62%;height:62%;border-radius:50%;
  background:radial-gradient(circle,rgba(138,180,255,.26),transparent 66%)}
</style></head><body>
<div class="glow"></div>
<div class="pad"><div>
  <div class="kicker">${esc(kicker || '')}</div>
  <div class="bar" style="margin:${u * 3}px 0 ${u * 4}px"></div>
  <div class="l1">${esc(line1 || '')}</div>${line2 ? `<div class="l2">${esc(line2)}</div>` : ''}
</div><div class="foot"><span class="chip">${esc(tag || '通往单片机之路')}</span><span>${esc(siteNote(size))}</span></div></div>
</body></html>`
}

function siteNote(size) {
  return size[0] > size[1] ? '寄存器级 · 每句话都能复现' : '寄存器级 · 站内有全篇'
}

function esc(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
}

export const COVER_SIZES = { bilibili: [1920, 1200], douyin: [1080, 1440] }

export async function buildCover(browser, ep, platform, outPath) {
  const size = ep.cover?.sizes?.[platform] || COVER_SIZES[platform] || [1920, 1200]
  const page = await browser.newPage({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: 1 })
  await page.setContent(coverHtml({ ...ep.cover, tag: ep.cover?.tag || `通往单片机之路 · ${ep.id.split('-')[0].toUpperCase()}`, size }), {
    waitUntil: 'load',
  })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: outPath })
  await page.close()
  log(`  🖼️  封面 ${size.join('×')} → ${outPath}`)
  return outPath
}

// B站的分P时间轴直接由实测时间轴生成，不手写（手写的对不上旁白）
// anim 场没有 title（画面本身就是内容），拿 note 当章节名，否则时间轴上会露出 cs-2 这种内部 id。
// 连 note 都没有时退回旁白首句：那个时间点观众听到的就是它，至少不是内部 id。
function sceneLabel(s) {
  if (!s) return ''
  if (s.title) return s.title
  if (s.kicker) return s.kicker
  const src = s.note?.trim() || s.narration?.trim()
  if (!src) return ''
  const act = src.match(/^第[一二三四五六七八九十百\d]+幕[：:]\s*([\s\S]+)$/)
  const body = (act ? act[1] : src).split(/[：:]/)[0].split(/[；;。]/)[0].split(/[，]/)[0].trim()
  return body.length > 24 ? `${body.slice(0, 24)}…` : body
}

function agenda(timeline, scenes) {
  const byId = new Map(scenes.map((s) => [s.id, s]))
  return timeline.scenes
    .filter((ts) => ts.frames / timeline.fps > 2)
    .map((ts) => `${fmtClock(ts.start)} ${sceneLabel(byId.get(ts.id)) || ts.id}`)
    .join('\n')
}

export function writeRelease({ ep, platform, outDir, timeline, cfg, videoPath, srtPath, coverPath, sceneTexts }) {
  const secs = timeline.totalFrames / timeline.fps
  const lines = [
    `# ${ep.title} · ${platform} 发布文案`,
    '',
    '## 成片',
    '',
    `- 视频：\`${videoPath}\``,
    `- 字幕：\`${srtPath}\`（${timeline.captions.length} 条，可直接导剪映）`,
    `- 封面：\`${coverPath}\``,
    `- 规格：${cfg.size.join('×')} / ${cfg.fps} fps / ${secs.toFixed(1)}s（${fmtClock(secs)}）`,
    '',
    '## 标题',
    '',
    ...((ep.publish?.[platform]?.titles) || [ep.title]).map((t, i) => `${i + 1}. ${t}`),
    '',
    '## 简介',
    '',
    (ep.publish?.[platform]?.intro || '').trim(),
    '',
    '## 时间轴',
    '',
    '```',
    agenda(timeline, sceneTexts),
    '```',
    '',
    '## 标签',
    '',
    (ep.publish?.[platform]?.tags || []).map((t) => `#${t}`).join(' '),
    '',
    '## 话题',
    '',
    (ep.publish?.[platform]?.topics || []).map((t) => `#${t}`).join(' '),
    '',
  ]
  const p = join(outDir, `发布-${platform}.md`)
  writeFileSync(p, lines.join('\n'))
  log(`  📝 发布文案 → ${p}`)
  return p
}
