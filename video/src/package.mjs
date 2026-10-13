import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { codeHtml, inline, FONT, MONO } from './layout.mjs'
import { fmtClock, log } from './util.mjs'

// 封面走 HTML 截图而不是 PIL：和正片同一套字体回退、同一套配色，
// 不会出现"封面有字、正片豆腐块"这种两边字体栈不一致的坑。
// 封面 = 一句钩子 + 一张物证 + 一个数字。
// 物证卡吃 episode.json 里那几行实跑产物，行首 "!"、{{}}、[[]] 的解释直接借正片的 codeHtml/inline
// （layout.mjs 导出），所以封面上那条红边和观众点进去看到的红边是同一句真话——不为封面另写一套。
function coverHtml({ kicker, line1, line2, tag, proof, proofShort, num, numNote, badge, size }) {
  const [w, h] = size
  const u = coverU(size)
  const vert = h > w
  // 竖版一行只放得下 ⌊929/字号⌋ 个汉字：158px 时是 5 个，"你给优先级 16" 会被断成
  // "你给优 / 先级 16"。汉字没有词边界，balance 只配平长度、救不了把词劈开，
  // 所以标题改成 keep-all：一段连着写死的汉字整体不许断，只能整段换行或整段缩——
  // 于是字号被自动顶到"最长那一段刚好放得下"的最大值，断点只会落在空格处。
  const big = vert ? (line2 ? 14.2 : 15.6) : line2 ? 13.2 : 14.6
  const wm = badge || (kicker || '').replace(/^.*·\s*/, '') || ''
  // 竖版窄，长证据行缩到地板也放不下——换一条更短的证据，而不是把字压到看不清
  const card = (vert ? proofShort || proof : proof) || ''
  const numbox = num
    ? `<div class="numbox"><div class="num" data-want="${(u * 13).toFixed(2)}">${inline(num)}</div>${numNote ? `<div class="numnote">${inline(numNote)}</div>` : ''}</div>`
    : ''
  const codeCard = card ? `<pre class="code fit" data-want="${(u * 3.35).toFixed(2)}">${codeHtml(card)}</pre>` : '<div class="spacer"></div>'
  // 横版：证据卡与数字并排压在底部。竖版：数字吃中间那段空白，卡留在脚注上方——
  // 不然 1440 高的画布会在标题和数字之间空出一条谁都不看的带子。
  const bottom = vert ? `<div class="mid">${numbox}</div>${codeCard}` : `<div class="bottom">${codeCard}${numbox}</div>`
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:${w}px;height:${h}px;font-family:${FONT};color:#e6eaf2;overflow:hidden;
  background:radial-gradient(125% 115% at 18% -8%,#16223c 0%,#0b1220 55%,#05080f 100%)}
.wm{position:absolute;right:${u * 1}px;top:${u * 26}px;font-size:${u * 44}px;font-weight:900;letter-spacing:-.05em;
  line-height:1;color:rgba(138,180,255,.075);font-family:${MONO};z-index:0}
.trace{position:absolute;left:0;right:0;bottom:${u * 20}px;height:${u * 1}px;
  background:linear-gradient(90deg,transparent,rgba(138,180,255,.22) 22%,rgba(79,209,150,.18) 60%,transparent)}
.pad{position:absolute;inset:0;padding:${u * 6.2}px ${u * 7}px;display:flex;flex-direction:column;gap:${u * 2.6}px;z-index:1}
.pill{flex:none;align-self:flex-start;font-size:${u * 2.9}px;font-weight:800;letter-spacing:.16em;color:#f0b45c;
  border:${u * .28}px solid rgba(240,180,92,.7);border-radius:999px;padding:${u * 1}px ${u * 3}px;background:rgba(240,180,92,.08)}
/* 标题两行共用 .head 上的字号：分行只换颜色。写在 .l1/.l2 上就得事后把 l1 缩完的值同步给 l2，
   那个同步既难读又会让"两行必须同大"这条不变量只在运行时成立。 */
.head{flex:none;margin-top:${u * 1.4}px;font-size:${u * big}px;line-height:1.12;font-weight:900;letter-spacing:-.025em;
  text-wrap:balance;word-break:keep-all}
/* keep-all 之后不能再加 overflow-wrap：那会让超长段自己劈开，缩字就量不到溢出，
   等于把"装不下"从一次硬失败换成一张悄悄断错的封面。 */
.l1{color:#f2f5fa}
.l2{color:#f0b45c}
.tk{white-space:nowrap}
.bar{height:${u * 1.1}px;width:${u * 15}px;margin:${u * 2.6}px 0 0;background:linear-gradient(90deg,#8ab4ff,#4fd196);border-radius:999px}
.mid{flex:1 0 auto;display:flex;flex-direction:column;justify-content:center;min-height:0}
.bottom{flex:none;margin-top:auto;display:flex;flex-direction:row;align-items:flex-end;gap:${u * 3}px}
/* 竖版里 pre.code 是列的直接子元素，flex:1 会去长"高度"——证据卡被拉成一大一空框。
   横版那条 flex:1 1 auto 要的是长宽度，所以只在竖版关掉。 */
.v pre.code{flex:none}
pre.code{flex:1 1 auto;min-width:0;background:rgba(15,23,40,.92);border:1px solid #26314a;border-left:${u * .55}px solid #8ab4ff;
  border-radius:${u * .9}px;padding:${u * 1.5}px ${u * 1.8}px;font-family:${MONO};font-size:${u * 3.35}px;line-height:1.42;
  color:#dbe3f0;white-space:pre;tab-size:4;overflow:hidden}
pre.code .ln{display:block;padding:0 ${u * .5}px;border-radius:3px}
pre.code .ln.ev{background:rgba(255,138,128,.15);box-shadow:inset ${u * .35}px 0 0 #ff8a80;color:#ffd9d5}
pre.code .ln.dim{color:#7f8ba0}
pre.code .hl{font-style:normal;color:#f0b45c;font-weight:700}
pre.code .bad{font-style:normal;color:#ff8a80;font-weight:700}
pre.code b{color:#8ab4ff}
.spacer{flex:1}
.numbox{flex:none;max-width:${vert ? 1e4 : u * 50}px;text-align:${vert ? 'left' : 'right'};padding-bottom:${u * .4}px}
.num{font-size:${u * 13}px;font-weight:900;line-height:.94;letter-spacing:-.03em;color:#f0b45c;font-family:${FONT};white-space:nowrap;
  text-shadow:0 0 ${u * 5}px rgba(240,180,92,.35)}
.numnote{margin-top:${u * 1.2}px;font-size:${u * 2.5}px;color:#8ab4ff;font-weight:600;letter-spacing:.02em}
.foot{flex:none;display:flex;align-items:center;gap:${u * 1.8}px;font-size:${u * 2.3}px;color:#8f9bb0}
.chip{border:1px solid #3b4453;border-radius:999px;padding:${u * .55}px ${u * 2}px;color:#4fd196;font-weight:700;background:rgba(79,209,150,.07)}
</style></head><body>
<div class="wm">${esc(wm)}</div>
<div class="trace"></div>
<div class="pad${vert ? ' v' : ''}">
  <div class="pill">${esc(kicker || '通往单片机之路')}</div>
  <div class="head" data-want="${(u * big).toFixed(2)}"><div class="l1">${headline(line1 || '')}</div>${line2 ? `<div class="l2">${headline(line2)}</div>` : ''}
    <div class="bar"></div></div>
  ${bottom}
  <div class="foot"><span class="chip">${esc(tag || '本机实跑')}</span><span>${esc(siteNote(size))}</span></div>
</div>
</body></html>`
}

function siteNote(size) {
  return size[0] > size[1] ? '寄存器级 · 每句话都能复现' : '寄存器级 · 站内有全篇'
}

function esc(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
}

// 标题里连着的英文/数字/符号必须整体换行：GPIOF->BSRR 断在箭头两边、168MHz 断成 168/MHz，
// 观众读到的是排版事故，不是钩子。汉字之间照常断，交给 text-wrap:balance 配平两行的长度。
function headline(s) {
  return esc(s).replace(/[A-Za-z0-9_][A-Za-z0-9_&;.#+\-/<>=:%()]*/g, (t) => `<span class="tk">${t}</span>`)
}

export const COVER_SIZES = { bilibili: [1920, 1200], douyin: [1080, 1440] }

// 封面字号单位：跟短边走（竖版按高度算，同样的代码行会直接顶出画布）。
// 排版和缩字地板两处都用它，各算一次的话竖版会一个用 10.8、一个用 14.4，地板凭空抬高 33%。
function coverU(size) {
  return Math.min(size[0], size[1]) / 100
}

// 封面上任何一处溢出都会被截图无声裁掉——这正是这一轮正片花掉 19 场去修的那类 bug。
// 所以这里也做自适应缩字，缩到地板还装不下就直接失败，不留一张半个字出画的封面。
// 判据是"这块的矩形出了 .pad 内容区"，不是 scrollHeight>clientHeight：
// 雅黑的自然行高约 1.21em，标题和数字都是故意压着行高排的，用后者量会把每一张都判成溢出。
// 相应地 .pad 的每个直接子元素都写了 flex:none——一允许压缩，超出的部分就从"出界"变成"被压扁"，量不到了。
async function fitCover(page, u) {
  return page.evaluate(async (u) => {
    const pad = document.querySelector('.pad')
    const cs = getComputedStyle(pad)
    const r = pad.getBoundingClientRect()
    const lim = {
      l: r.left + parseFloat(cs.paddingLeft),
      r: r.right - parseFloat(cs.paddingRight),
      t: r.top + parseFloat(cs.paddingTop),
      b: r.bottom - parseFloat(cs.paddingBottom),
    }
    const over = (el, own) => {
      const q = el.getBoundingClientRect()
      let v = Math.max(q.right - lim.r, lim.l - q.left, q.bottom - lim.b, lim.t - q.top)
      // 代码卡是 white-space:pre：行长超了自己的框就是被 overflow:hidden 剪掉，矩形看不出来
      if (own) v = Math.max(v, el.scrollWidth - el.clientWidth)
      return v
    }
    const shrink = (el, floor, own) => {
      let fs = parseFloat(getComputedStyle(el).fontSize)
      const start = fs
      for (let i = 0; i < 400; i++) {
        if (over(el, own) <= 1) break
        const next = Math.max(floor, fs - Math.max(0.25, fs * 0.02))
        if (next === fs) break
        fs = next
        el.style.fontSize = fs + 'px'
      }
      const q = el.getBoundingClientRect()
      return {
        from: start,
        to: fs,
        over: over(el, own),
        // 起始字号对不上元素自己声明的期望值 ⇒ 那条 CSS 规则根本没生效。
        // 这一轮真踩过：把 // 注释写进 <style> 里，CSS 顺手吞掉紧跟它的 .l1 规则，
        // 标题退回 16px、缩字量不到溢出，于是一张废封面"渲染成功"。
        lost: el.dataset.want ? start < parseFloat(el.dataset.want) * 0.9 : false,
        want: el.dataset.want || '',
        box: `${Math.round(q.width)}×${Math.round(q.height)} 右${Math.round(q.right)} 底${Math.round(q.bottom)} / 界${Math.round(lim.r)}×${Math.round(lim.b)}${own ? ` 文宽${el.scrollWidth}` : ''}`,
      }
    }
    const out = {}
    const code = document.querySelector('pre.code')
    if (code) out.code = shrink(code, u * 2.1, true)
    const head = document.querySelector('.head')
    // own=true：标题里的英文段是 .tk nowrap、整段汉字是 keep-all，撑出去的是 scrollWidth 而不是块的矩形
    if (head) out.head = shrink(head, u * 7, true)
    const num = document.querySelector('.num')
    if (num) out.num = shrink(num, u * 6, true)
    return out
  }, u)
}

export async function buildCover(browser, ep, platform, outPath) {
  const size = ep.cover?.sizes?.[platform] || COVER_SIZES[platform] || [1920, 1200]
  const u = coverU(size)
  const badge = ep.badge || ep.id.split('-')[0].toUpperCase()
  const page = await browser.newPage({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: 1 })
  await page.setContent(coverHtml({ ...ep.cover, badge, tag: ep.cover?.tag, size }), { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  const fit = await fitCover(page, u)
  const lost = Object.entries(fit).filter(([, r]) => r.lost)
  if (lost.length) {
    await page.close()
    throw new Error(`${platform} 封面样式没生效：${lost.map(([k, r]) => `${k} 起始 ${r.from.toFixed(1)}px、期望 ${r.want}px`).join('，')}——CSS 规则被吞了，不是字太多`)
  }
  const bad = Object.entries(fit).filter(([, r]) => r.over > 1)
  if (bad.length) {
    await page.close()
    throw new Error(`${platform} 封面装不下：${bad.map(([k, r]) => `${k} 超出 ${Math.round(r.over)}px（${r.box}，已缩到 ${r.to.toFixed(1)}px）`).join('，')}——把 cover.proof/num/line 改短，别指望裁掉`)
  }
  const shrunk = Object.entries(fit).filter(([, r]) => r.to < r.from - 0.5).map(([k, r]) => `${k} ${r.from.toFixed(0)}→${r.to.toFixed(0)}px`)
  await page.screenshot({ path: outPath })
  await page.close()
  log(`  🖼️  封面 ${size.join('×')} → ${outPath}${shrunk.length ? `（缩字 ${shrunk.join('，')}）` : ''}`)
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
