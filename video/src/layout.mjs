import { decorateAnim } from '../../docs/.vitepress/anim-decorate.mjs'
import { sceneSections } from './spec.mjs'

// 竖屏两栏代码并排放的宽度上限（单位是"显示格"，不是字符数）。
// 9:16 高而不宽：把 10 行的 codeB 摞在 code 底下，等于要在一屏里塞两屏代码，
// fitAll 只能把字压到 6px 才放得下（c3 抖音版 8 场就是这么"通过"审计的）。
// 并排则只吃一半宽度。上限按本机实测反推：并排时字号 ≈ 690/显示格，
// 42 格落 16.4px，43 格就掉到 15.9px——所以卡在 42。
// 必须按显示格算：等宽字里一个汉字占两格，"← 读进 r3，就这一次" 这种注释
// 按字符数只有 13，按格子是 20，用字符数会把根本并不下手的场次放进来。
const NARROW_COLS_W = 42
const CELLS = /[ᄀ-⺀-꓏가-힣豈-︰-＀-￠-￦]/

// 一行代码在等宽字里占多少显示格
export function codeCells(s) {
  let n = 0
  for (const ch of String(s)) n += CELLS.test(ch) ? 2 : 1
  return n
}

// 深色视频舞台的配色。动画本体不改成深色版：docs/.vitepress/anim-decorate.mjs
// 把 SVG 里硬编码的浅色 hex 换成 a-*/s-* 类，这里给这些类喂上站点深色主题的取值，
// 于是 docs/public/anim/*.svg 一个字都不用动就能出现在深色视频里。
const DARK = {
  bg: '#0b1220',
  bg2: '#131c33',
  animBg: '#1e222a',
  card: '#262c36',
  panel: '#222831',
  line: '#3b4453',
  ink: '#e6eaf2',
  sub: '#a9b3c1',
  muted: '#7b8696',
  brand: '#8ab4ff',
  accent: '#4fd196',
  accentDeep: '#7ee0b4',
  warn: '#f0b45c',
  warnDeep: '#f5c97a',
  gold: '#e6c95f',
  danger: '#ff8a80',
  washBlue: 'rgba(138,180,255,0.14)',
  washGreen: 'rgba(79,209,150,0.14)',
  washAmber: 'rgba(240,180,92,0.14)',
}

// 封面和正片共用同一套字体栈：封面换了字体，观众会以为是另一个频道做的
export const FONT = "'Microsoft YaHei','PingFang SC','Noto Sans SC','Segoe UI',system-ui,sans-serif"
export const MONO = "'Cascadia Mono','Consolas','Microsoft YaHei Mono',monospace"

function esc(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
}

export function inline(s) {
  // \n 留到最后一步再换：作者写 \n 就是要控制断行——竖屏三行大标题放任浏览器折行，
  // 会把"就死/了"劈开。放在 **…** 之后替换，才不会打断跨行的加粗匹配。
  return esc(s)
    .replace(/\{\{(.+?)\}\}/g, '<em class="hl">$1</em>')
    .replace(/\[\[(.+?)\]\]/g, '<em class="bad">$1</em>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\n/g, '<br>')
}

// 代码块行内标记：行首 "!" = 证据行（红底 + 左侧红条），"~" = 弱化行
export function codeHtml(src) {
  const lines = String(src).replace(/\n$/, '').split('\n')
  return lines
    .map((line) => {
      const bang = line.startsWith('!')
      const dim = line.startsWith('~')
      const text = bang || dim ? line.slice(1) : line
      const cls = bang ? 'ev' : dim ? 'dim' : ''
      return `<span class="ln ${cls}">${inline(text) || '&nbsp;'}</span>`
    })
    .join('')
}

function colHtml(label, src, extraClass = '') {
  if (!src) return ''
  return `<div class="col ${extraClass}">${label ? `<div class="collabel">${inline(label)}</div>` : ''}<pre class="fit code">${codeHtml(src)}</pre></div>`
}

// 「55 —— 说明」这种条目把数字单独拎出来放大；破折号由 CSS 的 .num::after 补，
// 所以这里要把它从文本里吃掉，否则屏幕上出现两个 ——。
// 只认 ASCII 开头的短前缀（数字、地址、计数），中文短语留给正文字号。
function bulletHtml(b) {
  const i = b.indexOf('——')
  if (i > 0) {
    const head = b.slice(0, i).trim()
    const rest = b.slice(i + 2).trim()
    if (rest && head.length <= 16 && /^[0-9a-zA-Z_]/.test(head) && !/[。；，、]/.test(head)) {
      return `<li><span class="num">${inline(head)}</span><span>${inline(rest)}</span></li>`
    }
  }
  return `<li>${inline(b)}</li>`
}

function bulletsHtml(items) {
  if (!items?.length) return ''
  return `<ul class="bullets fit">${items.map(bulletHtml).join('')}</ul>`
}

export function sceneHtml(sc, ctx) {
  const { index, total } = ctx
  const step = `<span class="step">${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span>`
  const head = sc.title ? `<div class="title fit">${inline(sc.title)}</div>` : ''
  const sub = sc.sub ? `<div class="sub fit">${inline(sc.sub)}</div>` : ''

  switch (sc.kind) {
    case 'anim': {
      const side = sc.bullets?.length ? `<div class="side">${head}${bulletsHtml(sc.bullets)}</div>` : head
      return `<div class="lay lay-anim">${side}<div class="animbox" data-anim="${sc.anim}"></div>${
        sc.note ? `<div class="note">${inline(sc.note)}</div>` : ''
      }</div>${step}`
    }
    case 'code': {
      const single = !sc.codeB
      const maxW = Math.max(
        ...[sc.code, sc.codeB].filter(Boolean).flatMap((c) => String(c).split('\n').map(codeCells)),
      )
      const narrow = !single && maxW <= NARROW_COLS_W
      return `<div class="lay lay-code">${head}<div class="cols ${single ? 'one' : narrow ? 'narrow' : ''}">${colHtml(
        sc.codeLabel || '你写的 C',
        sc.code,
      )}${colHtml(sc.codeBLabel || '-O2 编出来的汇编', sc.codeB, 'asm')}</div>${
        sc.note ? `<div class="note">${inline(sc.note)}</div>` : ''
      }</div>${step}`
    }
    case 'hook':
      return `<div class="lay lay-hook">${head}${sub}${
        sc.code ? `<div class="cols one" style="width:100%">${colHtml(sc.codeLabel, sc.code)}</div>` : ''
      }</div>${step}`
    case 'card':
      return `<div class="lay lay-card ${sc.tone || ''}"><div class="cardpanel">${
        sc.kicker ? `<div class="kicker">${inline(sc.kicker)}</div>` : ''
      }${head}${bulletsHtml(sc.bullets)}${sub}</div></div>${step}`
    case 'outro':
      return `<div class="lay lay-outro">${head}${bulletsHtml(sc.bullets)}${sub}<div class="url">${esc(
        ctx.url || '',
      )}</div></div>${step}`
    default:
      throw new Error(`未知 scene.kind: ${sc.kind}`)
  }
}

export function animMarkup(name, slug) {
  return decorateAnim(animSource(name), slug)
}

let animReader = null
export function setAnimSourceReader(fn) {
  animReader = fn
}
function animSource(name) {
  if (!animReader) throw new Error('没装动画读取器')
  return animReader(name)
}

export function pageHtml({ platform, size, safe, scenes, anims, kicker, badge, sections }) {
  const [w, h] = size
  const secs = sceneSections(scenes, sections)
  // 分节页头是可选增量：sections 缺省时下面走今天这条旧 DOM，一个字符都不变。
  // 旧集一旦误跑 video:check，审计输出要能一字不差复现，所以这里靠"要不要生成这两个
  // 元素"来分叉，而不是生成了再用 CSS 藏起来。
  const segmented = secs.some((s) => s)
  const payload = scenes.map((sc, i) => ({
    kind: sc.kind,
    html: sceneHtml(sc, { index: i, total: scenes.length, url: '通往单片机之路 · 见简介' }),
    anim: sc.anim || null,
    slug: `${platform}-${i}`,
    sec: secs[i],
  }))
  // 集号今天被印了两遍：badge 是「F5」，cover.kicker 是「通往单片机之路 · F5」。
  // 右格要留给小节 chip，所以左格收拢成「F5 + 系列名」，把 kicker 那条重复的集号尾巴摘掉。
  // 没分节的老集一个字都不动——那是回归口径的一部分。
  const brand2 =
    segmented && badge && kicker?.endsWith(` · ${badge}`) ? kicker.slice(0, -(badge.length + 3)) : kicker || ''
  const head = segmented
    ? `<div class="topbar"><span class="brandg"><span class="badge">${esc(badge || '')}</span>` +
      `<span class="brand2">${esc(brand2)}</span></span><span class="secchip" id="secchip"></span></div>` +
      // 横版底部已有 .ticks 按场分进度，页头只给文字；竖版 .ticks 是 display:none，
      // 这条按节的杠就是竖版唯一的进度载体。同屏两根按场进度是审计要拦的事。
      (platform === 'douyin' ? '<div class="secbar" id="secbar"></div>' : '')
    : `<div class="topbar"><span class="badge">${esc(badge || '')}</span><span class="brand2">${esc(kicker || '')}</span></div>`
  return `<!doctype html>
<html lang="zh-CN" class="dark"><head><meta charset="utf-8"><title>stage</title>
<style>
:root{
  --u:${(h / 100).toFixed(3)}px; --sw:${(w / 100).toFixed(3)}px;
  --bg:${DARK.bg}; --bg2:${DARK.bg2}; --anim-bg:${DARK.animBg}; --card:${DARK.card}; --panel:${DARK.panel};
  --line:${DARK.line}; --ink:${DARK.ink}; --sub:${DARK.sub}; --muted:${DARK.muted};
  --brand:${DARK.brand}; --accent:${DARK.accent}; --accent-deep:${DARK.accentDeep};
  --warn:${DARK.warn}; --warn-deep:${DARK.warnDeep}; --gold:${DARK.gold}; --danger:${DARK.danger};
  --wash-blue:${DARK.washBlue}; --wash-green:${DARK.washGreen}; --wash-amber:${DARK.washAmber};
  --font:${FONT}; --mono:${MONO};
}
/* 下面这组类名与 docs/public/anim/*.svg 经 decorateAnim 后得到的类一一对应 */
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${w}px;height:${h}px;overflow:hidden;background:#000}
body{font-family:var(--font);color:var(--ink);-webkit-font-smoothing:antialiased}
.frame{position:relative;width:${w}px;height:${h}px;
  background:radial-gradient(120% 100% at 50% 0%,var(--bg2) 0%,var(--bg) 62%,#070c17 100%);
  /* 底部留出一条字幕带：正文不能延伸进 .caps，否则渲染出来就是压字 */
  padding:calc(var(--u)*6) calc(var(--sw)*6) calc(var(--u)*15);display:flex;flex-direction:column}
.topbar{position:absolute;left:calc(var(--sw)*6);right:calc(var(--sw)*6);top:calc(var(--u)*3.2);
  display:flex;align-items:center;justify-content:space-between;font-size:calc(var(--u)*1.7);color:var(--muted);letter-spacing:.06em}
.topbar .badge{color:var(--brand);font-weight:600}
/* 分节页头：左格把 badge 与系列名收成一个组，右格留给当前小节。
   没 sections 的老集不会生成这两个元素，下面的规则也就不参与布局。 */
.topbar .brandg{display:flex;align-items:center;gap:calc(var(--sw)*1.2)}
.topbar .secchip{color:var(--sub);font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
.secbar{position:absolute;left:calc(var(--sw)*8);right:calc(var(--sw)*10);top:calc(var(--u)*8);
  display:flex;gap:calc(var(--u)*.5)}
.secbar i{flex:1;height:calc(var(--u)*.34);border-radius:99px;background:rgba(123,134,150,.22)}
.secbar i.on{background:rgba(138,180,255,.5)}
.secbar i.cur{background:var(--brand)}
.step{position:absolute;right:0;bottom:calc(var(--u)*.4);font-size:calc(var(--u)*1.5);color:var(--muted);
  font-variant-numeric:tabular-nums;letter-spacing:.08em}
/* padding-bottom 给 .step 单独留一条带：不留的话 .lay 撑满 .body，最后一行 .note 正好压在页码上 */
.body{flex:1;display:flex;min-height:0;min-width:0;position:relative;padding-top:calc(var(--u)*3);padding-bottom:calc(var(--u)*3.6)}
.lay{flex:1;display:flex;flex-direction:column;min-height:0;min-width:0;gap:calc(var(--u)*1.8)}
.fit{overflow:hidden;min-height:0}
/* 文字块一律 flex:none。.fit 自带 min-height:0，留着默认的 flex-shrink:1 时，
   一旦整场内容超高，flex 会把 .title 的盒子挤成 7px 高——fitAll 只能顺着把字
   缩到 6px 地板，抖音版三个 code 场景的标题就是这么变成一条细渣的。
   该收缩的是 .cols/pre.code，它们本来就有 fitAll 兜着。 */
.title,.sub,.note,.kicker,.url{flex:none}
.title{font-size:calc(var(--u)*3.9);line-height:1.3;font-weight:700;letter-spacing:-.01em}
.sub{font-size:calc(var(--u)*2.3);line-height:1.5;color:var(--sub)}
.note{font-size:calc(var(--u)*1.75);color:var(--muted);border-left:calc(var(--u)*.4) solid var(--brand);
  padding-left:calc(var(--sw)*1.4);line-height:1.45}
.bullets{list-style:none;display:flex;flex-direction:column;gap:calc(var(--u)*1.15);font-size:calc(var(--u)*2.1);line-height:1.42}
.bullets li{position:relative;padding-left:calc(var(--sw)*2.2);color:var(--ink)}
.bullets li::before{content:'';position:absolute;left:0;top:.52em;width:calc(var(--u)*.85);height:calc(var(--u)*.85);
  border-radius:50%;background:var(--brand)}
/* flex:0 1 auto —— 面板按内容收高，整组居中。写 flex:1 会把两个面板拉到满高，
   于是 8 行代码配 800px 的框，下半屏全是空的。 */
.cols{display:flex;gap:calc(var(--sw)*2);flex:0 1 auto;min-height:0;min-width:0}
.cols.one{max-width:100%}
/* min-height:0 是必须的：列向 flex 的子项默认 min-height:auto，抖音版 .cols 是 column，
   两个 .col 拒绝对抗收缩，.cols 直接顶穿自己的格子，压在 .note 上。 */
.col{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0;gap:calc(var(--u)*.9)}
.collabel{font-size:calc(var(--u)*1.7);color:var(--brand);font-weight:600;letter-spacing:.04em}
.col.asm .collabel{color:var(--warn)}
pre.code{flex:1;min-height:0;min-width:0;max-width:100%;background:var(--panel);border:1px solid var(--line);border-radius:calc(var(--u)*.9);
  padding:calc(var(--u)*1.5) calc(var(--sw)*1.6);font-family:var(--mono);font-size:calc(var(--u)*1.95);
  line-height:1.5;color:var(--ink);white-space:pre;tab-size:4}
pre.code .ln{display:block;min-height:1.5em;padding:0 calc(var(--sw)*.6);border-radius:3px}
pre.code .ln.ev{background:rgba(255,138,128,.14);box-shadow:inset calc(var(--u)*.35) 0 0 var(--danger);color:#ffd9d5}
pre.code .ln.dim{color:var(--muted)}
pre.code .hl{font-style:normal;color:var(--accent);font-weight:700}
pre.code .bad{font-style:normal;color:var(--danger);font-weight:700}
pre.code b{color:var(--brand)}
.lay-anim{gap:calc(var(--u)*1.4)}
.lay-anim .side{display:flex;flex-direction:column;gap:calc(var(--u)*1.2)}
.animbox{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden}
/* 卡片再包一层 .animcard 贴着画面收：.animbox 只当"可用区"量尺寸。
   以前描边背景直接挂在 flex:1 的 .animbox 上，720×400 的画面在 9:16 上
   上下各空出三百多像素，看着像渲染坏了。 */
.animcard{display:flex;align-items:center;justify-content:center;max-width:100%;max-height:100%;
  background:var(--anim-bg);border:1px solid var(--line);border-radius:calc(var(--u)*1.2);padding:calc(var(--u)*1.2);overflow:hidden}
.animbox svg{display:block;flex-shrink:0;font-family:var(--font)}
.lay-hook,.lay-card,.lay-outro{align-items:center;justify-content:center;text-align:center;gap:calc(var(--u)*2.4)}
.lay-code{justify-content:center;gap:calc(var(--u)*1.6)}
/* line-height 不能按拉丁文的直觉写 1.18：中文字体的行盒比 line-height 高，
   每行往下溢出 ~1.7px，四行就是 7px。fitAll 把这点溢出当成"放不下"，
   于是片头大标题从 107px 一路砍到 24px——两个平台都中招，只是抖音看着更明显。 */
.lay-hook .title,.lay-card .title{font-size:calc(var(--u)*6.2);line-height:1.34}
/* 片头压一条品牌色横杠：整屏只有两行字时，这条杠是唯一的视觉锚点 */
.lay-hook .title::before{content:'';display:block;width:calc(var(--u)*9);height:calc(var(--u)*.55);
  border-radius:99px;background:var(--brand);margin:0 auto calc(var(--u)*2.4)}
.lay-hook .cols{flex:0 1 auto;min-height:calc(var(--u)*16);max-width:${platform === 'douyin' ? '92%' : '76%'}}
/* kind=card 过去只改标题颜色，屏幕上根本没有"卡"。给它真正的面板，
   空白从"没排版"变成"卡片四周的留白"。 */
.lay-card .cardpanel{display:flex;flex-direction:column;align-items:center;text-align:center;
  gap:calc(var(--u)*2.2);max-width:${platform === 'douyin' ? '94%' : '78%'};
  background:linear-gradient(160deg,rgba(38,44,54,.94),rgba(20,26,36,.86));
  border:1px solid var(--line);border-left:calc(var(--u)*.75) solid var(--brand);
  border-radius:calc(var(--u)*1.8);padding:calc(var(--u)*4.2) calc(var(--sw)*4.2);
  box-shadow:0 calc(var(--u)*1.4) calc(var(--u)*5) rgba(0,0,0,.5)}
.lay-card.danger .cardpanel{border-left-color:var(--danger)}
.lay-card.good .cardpanel{border-left-color:var(--accent)}
.lay-card.gold .cardpanel{border-left-color:var(--gold)}
.lay-card.danger .title{color:var(--danger)}
.lay-card.good .title{color:var(--accent)}
.lay-card.gold .title{color:var(--gold)}
.lay-card .kicker{font-size:calc(var(--u)*2);color:var(--warn);font-weight:700;letter-spacing:.2em}
.lay-card .bullets,.lay-outro .bullets{text-align:left;align-items:flex-start}
/* 「55 —— 说明」这类条目：数字单独一档字号，扫一眼就抓到数 */
.bullets li{display:flex;align-items:baseline;gap:calc(var(--sw)*1.2)}
.bullets .num{font-family:var(--mono);font-weight:800;font-size:calc(var(--u)*2.9);color:var(--brand);
  line-height:1.1;white-space:nowrap}
.bullets .num::after{content:'——';color:var(--muted);font-weight:400;font-size:calc(var(--u)*1.6);margin-left:calc(var(--sw)*.6)}
.lay-card.danger .num{color:var(--danger)}
.lay-card.gold .num{color:var(--gold)}
.lay-card.good .num{color:var(--accent)}
.lay-outro .url{font-family:var(--mono);font-size:calc(var(--u)*2.2);color:var(--brand);
  border:1px solid var(--line);border-radius:999px;padding:calc(var(--u)*.9) calc(var(--sw)*2.6)}
.watermark{position:absolute;right:calc(var(--sw)*2.4);bottom:calc(var(--u)*5);font-size:calc(var(--u)*24);
  font-weight:800;line-height:1;letter-spacing:-.05em;color:rgba(138,180,255,.05);pointer-events:none}
/* 分场进度条：只跟 index 有关，同一场内恒定，不会打穿逐帧去重 */
.ticks{position:absolute;left:calc(var(--sw)*6);right:calc(var(--sw)*6);bottom:calc(var(--u)*1.6);
  display:flex;gap:calc(var(--u)*.45)}
.ticks i{flex:1;height:calc(var(--u)*.4);border-radius:99px;background:rgba(123,134,150,.22)}
.ticks i.on{background:rgba(138,180,255,.5)}
.ticks i.cur{background:var(--brand)}
.caps{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(var(--u)*8);max-width:86%;text-align:center;opacity:0}
.caps span{display:inline-block;font-size:calc(var(--u)*2.85);line-height:1.42;font-weight:600;text-wrap:balance;
  background:rgba(7,12,23,.82);border:1px solid rgba(138,180,255,.22);border-radius:calc(var(--u)*1.1);
  padding:calc(var(--u)*.75) calc(var(--sw)*2.2);box-shadow:0 calc(var(--u)*.5) calc(var(--u)*2) rgba(0,0,0,.5)}
${platform === 'douyin' ? `/* 竖屏安全区：抖音信息流右侧的点赞/评论/头像一列、底部的 @作者名 +
   描述 + 音乐条，都是客户端叠上来的，各版本位置还会动。正文本来就止步于
   22u 的下边距，这里只补两处真正压线的东西：右边多让一格给图标列，
   字幕从 12u 抬到 16u 脱离描述区，进度点整条藏掉——右下角的「03 / 09」
   已经把同一件事说清楚了，留着它只会被抖音自己的文字压住。 */
.frame{padding:calc(var(--u)*10) calc(var(--sw)*10) calc(var(--u)*22) calc(var(--sw)*8)}
.topbar{top:calc(var(--u)*5);right:calc(var(--sw)*10)}
.caps{left:calc(var(--sw)*8);right:calc(var(--sw)*10);transform:none;max-width:none;bottom:calc(var(--u)*16)}
.ticks{display:none}
.title{font-size:calc(var(--u)*2.6)}.sub{font-size:calc(var(--u)*1.9)}
.lay-hook .title,.lay-card .title{font-size:calc(var(--u)*5.6)}
pre.code{font-size:calc(var(--u)*1.4)}
.cols{flex-direction:column}
.cols.narrow{flex-direction:row;align-items:flex-start}
.cols.narrow .col{flex:1 1 0}
.bullets{font-size:calc(var(--u)*2.05)}
.bullets .num{font-size:calc(var(--u)*3.1)}
.animcard{padding:calc(var(--u)*.8)}
.watermark{font-size:calc(var(--u)*20);bottom:calc(var(--u)*24)}
.caps span{font-size:calc(var(--u)*2.1)}` : ''}
svg .a-bg{fill:var(--anim-bg)}svg .a-card{fill:var(--card)}svg .a-panel{fill:var(--panel)}
svg .a-line{fill:var(--line)}svg .a-ink{fill:var(--ink)}svg .a-sub{fill:var(--sub)}svg .a-muted{fill:var(--muted)}
svg .a-brand{fill:var(--brand)}svg .a-accent{fill:var(--accent)}svg .a-accent-deep{fill:var(--accent-deep)}
svg .a-warn{fill:var(--warn)}svg .a-warn-deep{fill:var(--warn-deep)}svg .a-gold{fill:var(--gold)}
svg .a-danger{fill:var(--danger)}svg .a-wash-blue{fill:var(--wash-blue)}svg .a-wash-green{fill:var(--wash-green)}
svg .a-wash-amber{fill:var(--wash-amber)}
svg .s-brand{stroke:var(--brand)}svg .s-accent{stroke:var(--accent)}svg .s-accent-deep{stroke:var(--accent-deep)}
svg .s-warn{stroke:var(--warn)}svg .s-danger{stroke:var(--danger)}svg .s-card{stroke:var(--card)}
svg .s-line{stroke:var(--line)}svg .s-muted{stroke:var(--muted)}svg .s-sub{stroke:var(--sub)}svg .s-ink{stroke:var(--ink)}
svg .a-mono{font-family:var(--mono)}
</style></head>
<body>
<div class="frame">
  <div class="watermark">${esc(badge || '')}</div>
  ${head}
  <div class="body" id="body"></div>
  <div class="ticks" id="ticks"></div>
  <div class="caps" id="caps"><span id="captext"></span></div>
</div>
<script>
window.PAYLOAD = ${JSON.stringify(payload)};
window.ANIMS = ${JSON.stringify(anims)};
window.MCU = (function () {
  var body = document.getElementById('body');
  var caps = document.getElementById('caps');
  var captext = document.getElementById('captext');
  var ticks = document.getElementById('ticks');
  var secchip = document.getElementById('secchip');
  var secbar = document.getElementById('secbar');
  var current = -1, svg = null;

  // 子孙的文字溢出不冒泡：pre.code 里超长那一行是 .ln（display:block、
  // overflow:visible）自己的 scrollWidth 超了 18px，父级 .fit 的 pre 却报
  // sw==cw——抖音 code-04 被切掉的那个 "B" 就是这么在 fitAll 和审计两轮里
  // 都全绿的。横向裁切必须连着块级子孙一起量，纵向不用：块级子项撑高父盒，
  // scrollHeight 本来就带上了。
  function overX(el, bh) {
    var v = el.scrollWidth - el.clientWidth - bh;
    for (var i = 0; i < el.children.length; i++) {
      var k = el.children[i];
      var kcs = getComputedStyle(k);
      if (kcs.overflowX !== 'visible') continue;
      var kbh = parseFloat(kcs.borderLeftWidth) + parseFloat(kcs.borderRightWidth);
      var kv = k.scrollWidth - k.clientWidth - kbh;
      if (kv > v) v = kv;
    }
    return v;
  }

  function fitAll(root) {
    root.querySelectorAll('.fit').forEach(function (el) {
      var cs = getComputedStyle(el);
      var fs = parseFloat(cs.fontSize);
      var bv = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth)
      var bh = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth)
      var guard = 0;
      while (guard++ < 60 && fs > 6) {
        // Chromium 把 border 折进 scrollHeight/scrollWidth：一圈 1px 描边让
        // scrollHeight 恒比 clientHeight 大 2px，那不是裁切。
        // 纵向再给 0.12fs 的容差：中文字体行盒高于 line-height，每行亚像素下溢，
        // 四行能累计 7px，被当成"放不下"就会把大标题一路砍到地板。
        // 真溢出至少是一整行（≈1.3fs），0.12fs 不可能吞掉它。
        var slackV = 1 + bv + Math.ceil(fs * 0.12)
        if (el.scrollHeight <= el.clientHeight + slackV && overX(el, bh) <= 1) break
        // 步长跟着字号走。固定 1px 太粗：c3 抖音 var-C 只溢出 2px，一步就从
        // 16.88 掉到 15.88，撞进审计 16px 的地板，把"缩一点就好"变成"报错"。
        fs -= Math.max(0.25, fs * 0.02)
        el.style.fontSize = fs.toFixed(2) + 'px'
      }
    });
  }

  function fitSvg(box, node) {
    var vb = (node.getAttribute('viewBox') || '0 0 720 400').split(/\\s+/).map(Number);
    // 可用宽高 = 外层 .animbox 的净空，再减掉 .animcard 自己的 padding 和描边。
    // 不能拿 .animcard 的 clientWidth 来量：它现在贴着 svg 收缩，量出来是循环依赖。
    // 少了描边那两项也不行——一圈 2px 在 z≈2.3 的放大下会把画面顶出可用区。
    var cs = getComputedStyle(node.parentElement);
    var cutW = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
      + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
    var cutH = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
      + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    var availW = box.clientWidth - cutW;
    var availH = box.clientHeight - cutH;
    if (!availW || !availH) return;
    var z = Math.min(availW / vb[2], availH / vb[3]);
    node.setAttribute('width', Math.floor(vb[2] * z));
    node.setAttribute('height', Math.floor(vb[3] * z));
  }

  function setup(i) {
    if (i === current) return;
    var item = window.PAYLOAD[i];
    body.innerHTML = item.html;
    var box = body.querySelector('.animbox');
    svg = null;
    if (box && item.anim) {
      box.innerHTML = '<div class="animcard">' + window.ANIMS[item.slug] + '</div>';
      svg = box.querySelector('svg');
      fitSvg(box, svg);
      svg.pauseAnimations();
      svg.setCurrentTime(0);
    }
    fitAll(body);
    drawTicks(i);
    drawHeader(item.sec);
    current = i;
  }

  // 进度杠只跟场次号有关：同一场内 DOM 一字不变，逐帧去重才不会被打穿。
  function drawTicks(i) {
    var n = window.PAYLOAD.length;
    if (ticks.childElementCount !== n) {
      ticks.innerHTML = '';
      for (var k = 0; k < n; k++) ticks.appendChild(document.createElement('i'));
    }
    for (var j = 0; j < n; j++) {
      var el = ticks.children[j];
      el.className = j === i ? 'cur' : j < i ? 'on' : '';
    }
  }

  // 页头和小节杠继承同一条硬约束：只随场次号变，绝不随帧时间 t 变
  //（见上面 drawTicks 那条注释——一集上万帧，DOM 在场内必须一字不变）。
  // 没分节的集这两个元素根本不存在，函数直接返回，DOM 与改版前完全相同。
  function drawHeader(sec) {
    if (secchip) secchip.textContent = sec ? ('第 ' + sec.i + '/' + sec.n + ' 节 · ' + sec.title) : '';
    if (!secbar) return;
    var n = sec ? sec.n : 0;
    secbar.style.display = sec ? 'flex' : 'none';
    if (secbar.childElementCount !== n) {
      secbar.innerHTML = '';
      for (var k = 0; k < n; k++) secbar.appendChild(document.createElement('i'));
    }
    for (var j = 0; j < n; j++) {
      secbar.children[j].className = j + 1 === sec.i ? 'cur' : j + 1 < sec.i ? 'on' : '';
    }
  }

  function seek(t) {
    if (!svg) return;
    svg.setCurrentTime(t);
    // Chromium 的 SMIL 更新是惰性的：setCurrentTime 只记时间，属性重算等到下一次
    // 样式/布局才做。读一次几何量把它冲出来，否则截图会慢一帧。
    void svg.getBoundingClientRect();
  }

  function caption(text, opacity) {
    if (text === null) { caps.style.opacity = 0; return; }
    if (captext.textContent !== text) captext.textContent = text;
    caps.style.opacity = opacity;
  }

  // reveal：每场开头 0.27s 内容淡入并上移，硬切读起来就像有转场。
  // 只作用于 .body，字幕带和进度杠不参与，它们各自已有淡入。
  async function frame(i, t, cap, opacity, reveal) {
    setup(i);
    seek(t);
    caption(cap, opacity);
    var r = reveal === undefined ? 1 : reveal;
    if (r >= 1) {
      body.style.opacity = 1;
      body.style.transform = 'none';
    } else {
      body.style.opacity = r.toFixed(3);
      body.style.transform = 'translateY(' + ((1 - r) * 16).toFixed(2) + 'px)';
    }
    await raf(2);
  }

  // 双 rAF：seek 之后必须让 Chromium 真正走完一次样式重算 + 合成，
  // 否则 page.screenshot 可能截到上一帧的画面。n=2 够，n=3 更稳。
  function raf(n) {
    return new Promise(function (resolve) {
      var left = n || 2;
      (function step() {
        if (--left <= 0) return resolve();
        requestAnimationFrame(step);
      })();
    });
  }
  return { setup: setup, seek: seek, caption: caption, frame: frame, raf: raf };
})();
</script>
</body></html>`
}
