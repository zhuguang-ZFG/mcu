#!/usr/bin/env node
// 动画版式审计（命令行版）：出界 / 压字 / 整幅无可见文字。
// 判定逻辑与 scripts/anim-audit.html 同源（墨水盒而非 em 盒，见 animation.md §7），
// 区别是：① 用 Playwright 无头跑，可进门禁；② 清单直接扫 docs/public/anim/，不再手维护 LIST；
// ③ 除阶段中点外再按 --step 等距加采样点——阶段中点抓不到"渐显过程中两行短暂相叠"。
//
//   node scripts/anim-audit.mjs                 # 全量
//   node scripts/anim-audit.mjs context-switch  # 只审指定图（可多个）
//   node scripts/anim-audit.mjs --step 0.5      # 额外每 0.5s 采样一次（默认 1s；0 关闭）
//   node scripts/anim-audit.mjs --font-scale 1.08  # 模拟更宽的回退字体（本地复现 CI 的 Linux 字体度量）
//   node scripts/anim-audit.mjs --json          # 机器可读输出
//
// 为什么需要 --font-scale：图里写的是 'Segoe UI','Microsoft YaHei' 字栈，Windows 本地用雅黑，
// CI 的 ubuntu-latest 上没有雅黑，Chromium 退回 Noto Sans CJK——同一串中文宽约 5~8%。
// 于是"本地全绿、CI 报 8 张出界"成了常态，且本地无从复现。这个开关按倍率放大文字的墨水盒
// （宽度绕水平中心、竖向绕基线），把 CI 的字体度量搬到本地来。
import { readdirSync, readFileSync } from 'node:fs'
import { resolve, basename } from 'node:path'
import { chromium } from '@playwright/test'

const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const step = Number(flag('--step', '1'))
const fontScale = Number(flag('--font-scale', '1'))
const asJson = args.includes('--json')
const picked = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--step' && args[i - 1] !== '--font-scale')

const dir = resolve('docs/public/anim')
const names = (picked.length ? picked : readdirSync(dir).filter(f => f.endsWith('.svg')).map(f => basename(f, '.svg'))).sort()

// 在页面里执行的审计函数：输入 svg 文本，返回问题列表
function auditInPage({ svgText, step, fontScale }) {
  const EPS = 0.5
  const box = document.createElement('div')
  box.style.cssText = 'position:fixed;left:0;top:0'
  box.innerHTML = svgText
  document.body.appendChild(box)
  const svg = box.querySelector('svg')
  const vb = svg.getAttribute('viewBox').split(/\s+/).map(Number)
  const W = vb[2], H = vb[3]
  svg.setAttribute('width', W); svg.setAttribute('height', H)
  void svg.getBoundingClientRect()
  const durs = [...svg.querySelectorAll('animate,animateTransform,animateMotion')]
    .map(a => parseFloat(a.getAttribute('dur'))).filter(n => !isNaN(n))
  const master = Math.max(...durs)
  const rect0 = svg.getBoundingClientRect()
  const mctx = document.createElement('canvas').getContext('2d')

  const opacityOf = el => { let p = el, acc = 1; while (p && p.nodeType === 1) { acc *= parseFloat(getComputedStyle(p).opacity); p = p.parentElement } return acc }
  const boxOf = el => {
    const r = el.getBoundingClientRect()
    const out = { x: r.x - rect0.x, y: r.y - rect0.y, w: r.width, h: r.height }
    let baseline = null
    if (el.tagName === 'text') {
      try {
        const st = getComputedStyle(el)
        mctx.font = `${st.fontStyle} ${st.fontWeight} ${st.fontSize} ${st.fontFamily}`
        const m = mctx.measureText(el.textContent)
        const k = r.height / (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)
        baseline = out.y + m.fontBoundingBoxAscent * k
        out.iy0 = baseline - m.actualBoundingBoxAscent * k
        out.iy1 = baseline + m.actualBoundingBoxDescent * k
      } catch { /* 退回 em 盒 */ }
    }
    out.iy0 = out.iy0 ?? out.y; out.iy1 = out.iy1 ?? out.y + out.h
    if (fontScale !== 1 && el.tagName === 'text') {
      // 只放大字宽（绕锚点）：Linux 回退字体与雅黑的差异主要在字宽，
      // 竖向墨迹高度几乎不变——放大竖向会造出 CI 上不存在的压字。
      const anchor = getComputedStyle(el).textAnchor
      const ax = anchor === 'middle' ? out.x + out.w / 2 : anchor === 'end' ? out.x + out.w : out.x
      out.w *= fontScale; out.x = anchor === 'middle' ? ax - out.w / 2 : anchor === 'end' ? ax - out.w : ax
    }
    return out
  }
  const ts = new Set([master * 0.02, master * 0.9])
  for (const a of svg.querySelectorAll('animate')) {
    if (a.getAttribute('calcMode') !== 'discrete') continue
    const kt = (a.getAttribute('keyTimes') || '').split(';').map(Number).filter(n => !isNaN(n))
    for (let i = 0; i + 1 < kt.length; i++) ts.add(master * (kt[i] + kt[i + 1]) / 2)
  }
  if (step > 0) for (let t = step; t < master; t += step) ts.add(t)
  const times = [...ts].filter(t => t >= 0 && t <= master).sort((a, b) => a - b)

  const problems = new Map()
  const push = (key, t, detail) => { if (!problems.has(key)) problems.set(key, { detail, ts: [] }); problems.get(key).ts.push(+t.toFixed(2)) }
  for (const t of times) {
    svg.setCurrentTime(t)
    const vis = [...svg.querySelectorAll('text')].filter(el => opacityOf(el) > 0.05 && el.textContent.trim() && el.getBoundingClientRect().width > 0)
    if (!vis.length) push('blank', t, '整幅无可见文字')
    const boxes = vis.map(el => ({ b: boxOf(el), s: el.textContent.trim().slice(0, 16) }))
    for (const { b, s } of boxes) {
      if (b.x < -EPS || b.y < -EPS || b.x + b.w > W + EPS || b.y + b.h > H + EPS)
        push('out|' + s, t, `出界「${s}」box=${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.w)}x${Math.round(b.h)}`)
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      if (boxes[i].s === boxes[j].s) continue
      const a = boxes[i].b, c = boxes[j].b
      const ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x)
      const oy = Math.min(a.iy1, c.iy1) - Math.max(a.iy0, c.iy0)
      if (ox > 3 && oy > 1)
        push('hit|' + boxes[i].s + '|' + boxes[j].s, t, `压字「${boxes[i].s}」×「${boxes[j].s}」横向 ${Math.round(ox)}px、竖向墨水重叠 ${oy.toFixed(1)}px`)
    }
  }
  box.remove()
  return { W, H, master, samples: times.length, problems: [...problems.values()] }
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
await page.setContent('<!doctype html><html lang="zh-CN"><body style="margin:0"></body></html>')
const report = []
for (const name of names) {
  const svgText = readFileSync(resolve(dir, name + '.svg'), 'utf8')
  try {
    const r = await page.evaluate(auditInPage, { svgText, step, fontScale })
    report.push({ name, ...r })
  } catch (e) {
    report.push({ name, error: String(e), problems: [{ detail: '异常 ' + e, ts: [] }] })
  }
}
await browser.close()

const bad = report.filter(r => r.problems.length)
if (asJson) {
  console.log(JSON.stringify(report, null, 2))
} else {
  for (const r of report) {
    if (!r.problems.length) continue
    console.log(`✗ ${r.name}（${r.W}x${r.H}，${r.master}s，采样 ${r.samples} 点）`)
    for (const p of r.problems) {
      const t = p.ts.length === 1 ? `${p.ts[0]}s` : `共 ${p.ts.length} 个时刻，${p.ts.slice(0, 4).join('/')}s…`
      console.log(`    ${p.detail}（${t}）`)
    }
  }
  console.log(bad.length ? `\n${report.length} 张审完，${bad.length} 张有版式问题` : `✓ ${report.length} 张动画版式审计通过（出界 / 压字 / 空幅）`)
}
process.exit(bad.length ? 1 : 0)
