#!/usr/bin/env node
// 视频产线入口：
//   npm run video:lint  -- [id…]
//   npm run video:check -- [id…] [--platform …]   只跑舞台+排版审计，不渲帧、不合成配音
//   npm run video:build -- [id…] [--platform bilibili|douyin|both] [--force-audio] [--stills] [--no-bgm]
//   npm run video:calib -- [--anims a,b,c]      seek 门限双向标定（改过 stage.mjs 的常量就跑它）
// 六个阶段顺序固定（lint → tts → timeline → stage → mux → package），
// 每阶段的产物都落在 video/out/<id>/<platform>/，改旁白只重合成改动句、改画面只重渲染该集。

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { episodePath, loadEpisode, platformConfig, resolveScenes, validateEpisode } from './spec.mjs'
import { buildAudio } from './tts.mjs'
import { buildRenderPlan, planSummary } from './timeline.mjs'
import { openBrowser, openStage, seekSelfTest } from './stage.mjs'
import { runCalibration } from './calib.mjs'
import { captureStills, renderFrames } from './render.mjs'
import { BGM_PATH, mux } from './mux.mjs'
import { buildCover, writeRelease } from './package.mjs'
import { EPISODES_DIR, FFMPEG, OUT_DIR, ensureDir, fmtClock, log } from './util.mjs'

function parseArgv(argv) {
  const [cmd, ...rest] = argv
  const pos = []
  const flags = {}
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]
    if (!a.startsWith('--')) {
      pos.push(a)
      continue
    }
    const key = a.slice(2)
    const next = rest[i + 1]
    if (next && !next.startsWith('--')) {
      flags[key] = next
      i++
    } else {
      flags[key] = true
    }
  }
  return { cmd, pos, flags }
}

function listEpisodes() {
  if (!existsSync(EPISODES_DIR)) return []
  return readdirSync(EPISODES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(episodePath(d.name)))
    .map((d) => d.name)
    .sort()
}

function pickEpisodes(pos) {
  const ids = pos.length ? pos : listEpisodes()
  if (!ids.length) throw new Error(`video/episodes/ 下没有任何 episode，先写一个 episode.json`)
  for (const id of ids) {
    if (!existsSync(episodePath(id))) throw new Error(`找不到 ${episodePath(id)}`)
  }
  return ids
}

// ---------------------------------------------------------------- lint

function lintEpisode(id) {
  const ep = JSON.parse(readFileSync(episodePath(id), 'utf8'))
  const { errs, warns } = validateEpisode(ep, id)
  if (!ep.cover?.line1) errs.push('缺 cover.line1（封面大字）')
  if (!ep.publish) errs.push('缺 publish（发布标题/简介/标签）')
  for (const [name, cfg] of Object.entries(ep.platforms || {})) {
    if (!ep.publish?.[name]?.titles?.length) errs.push(`publish.${name}.titles 为空`)
    if (!ep.publish?.[name]?.intro?.trim()) errs.push(`publish.${name}.intro 为空`)
    const sceneIds = new Set(resolveScenes(ep, name).map((s) => s.id))
    for (const key of Object.keys(cfg.narration || {})) {
      if (!sceneIds.has(key)) errs.push(`platforms.${name}.narration 覆写了不存在的场景 "${key}"`)
    }
    for (const [i, sid] of (cfg.pick || []).entries()) {
      const srcIds = ep.platforms[cfg.reuseFrom]?.scenes
      if (!srcIds?.some((s) => s.id === sid)) errs.push(`platforms.${name}.pick[${i}] = "${sid}" 不在 ${cfg.reuseFrom} 的场景里`)
    }
  }
  return { ep, errs, warns }
}

function cmdLint(ids) {
  let bad = 0
  for (const id of pickEpisodes(ids)) {
    const { ep, errs, warns } = lintEpisode(id)
    const plats = Object.keys(ep.platforms || {})
    log(`\n▶ ${id}  ${ep.title}  [${plats.join(', ')}]`)
    for (const w of warns) log(`  ⚠️  ${w}`)
    for (const e of errs) log(`  ❌ ${e}`)
    if (errs.length) bad++
    else log(`  ✅ 通过：${plats.map((p) => `${p} ${resolveScenes(ep, p).length} 场`).join('，')}`)
  }
  log(`\n${bad ? `❌ ${bad} 个 episode 未通过` : '✅ 全部通过'}`)
  return bad ? 1 : 0
}

// ---------------------------------------------------------------- 排版审计
// 本机的模型读不了图片，计划里"抽帧人检"这条走不通，于是把人要盯的东西量化成七条：
// ① 中文字体真的加载了（否则整屏豆腐块）；② 没有任何元素越出画布；
// ③ .fit 兜底缩字之后不再被裁（被裁 = 这块内容该拆场）；④ 字幕条不压正文、
// 兄弟块不相叠、子块不顶穿 .lay；⑤ 缩完仍要 ≥16px；⑥ SVG 等比不变形；
// ⑦ 大标题折行后末行不许只剩一两个字。渲染前跑一遍，有问题直接 fail，
// 比渲两万帧再人眼找便宜得多。npm run video:check 单跑这一段，不渲帧。

async function auditLayout(stage, plan) {
  const issues = []
  const longest = new Map()
  for (const cap of plan.captions) {
    const cur = longest.get(cap.scene)
    if (!cur || cap.text.length > cur.length) longest.set(cap.scene, cap.text)
  }
  const rows = []
  for (const sc of plan.scenes) {
    const r = await stage.page.evaluate(
      ({ index, capText }) => {
        window.MCU.setup(index)
        window.MCU.caption(capText || null, 1)
        const win = { w: window.innerWidth, h: window.innerHeight }
        const rect = (el) => el.getBoundingClientRect()
        const name = (el) => `${el.tagName.toLowerCase()}.${String(el.className || '-').replace(/\s+/g, '.')}`
        const capBox = rect(document.getElementById('caps'))

        const overflow = []
        for (const el of document.querySelectorAll('.frame *')) {
          const b = rect(el)
          if (!b.width || !b.height) continue
          if (b.left < -0.5 || b.top < -0.5 || b.right > win.w + 0.5 || b.bottom > win.h + 0.5) {
            overflow.push(`${el.tagName.toLowerCase()}.${el.className || '-'} ${Math.round(b.left)},${Math.round(b.top)},${Math.round(b.right)},${Math.round(b.bottom)}`)
          }
        }

        const clipped = []
        // fitAll 的地板是 6px，等于把"放不下"偷偷降级成"看不见"。抖音版三个 code
        // 场景的标题就是这么被 flex 挤成 5.9px 的——审计当时全绿。16px 按本机实测定：
        // 1080 画布上约 1.5% 高，手机上勉强可读；S16 抖音最紧的一场落在 16.9px。
        const MIN_FONT = 16
        let minFont = Infinity
        let minFontTag = '-'
        const tooSmall = []
        for (const el of document.querySelectorAll('.fit')) {
          const cs = getComputedStyle(el)
          const fs = parseFloat(cs.fontSize)
          const tag = `${el.tagName.toLowerCase()}.${String(el.className).replace(/\s+/g, '.')}`
          if (fs < minFont) {
            minFont = fs
            minFontTag = `${tag}「${el.textContent.trim().slice(0, 14)}…」`.replace(/…」$/, '」')
          }
          if (fs < MIN_FONT) tooSmall.push(`${tag} 只剩 ${fs.toFixed(1)}px：${el.textContent.trim().slice(0, 24)}`)
          // Chromium 把 border 算进 scrollHeight/scrollWidth。pre.code 有一圈 1px 描边，
          // 于是它永远"超出" 2px/2px——那不是裁切，别拿它当失败。
          // 纵向容差跟 layout.mjs 的 fitAll 保持一致：中文字体行盒高于 line-height，
          // 每行亚像素下溢，四行能到 7px，两边口径不一样就会一边放行一边报错。
          const bv = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth)
          const bh = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth)
          const overV = el.scrollHeight - el.clientHeight - bv - Math.ceil(fs * 0.12)
          const overH = el.scrollWidth - el.clientWidth - bh
          if (overV > 1 || overH > 1) {
            clipped.push(`${tag} 超出 ${Math.round(overV)}px/${Math.round(overH)}px @${fs.toFixed(1)}px`)
          }
        }

        const hit = []
        if (capText) {
          for (const el of document.querySelectorAll('.title,.sub,.bullets,.cols,.animbox,.note,.url,.kicker')) {
            const b = rect(el)
            if (!b.width || !b.height) continue
            if (b.bottom > capBox.top + 1 && b.top < capBox.bottom - 1 && b.right > capBox.left + 1 && b.left < capBox.right - 1) {
              hit.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`)
            }
          }
        }

        // 兄弟相压：上面那三条各查了「越画布」「自身裁切」「压进字幕带」，
        // 但 .note 压在 .cols 上、.step 压在 .note 上这类同层相叠一个都不查。
        // 抖音版 .cols 是 column 方向，内容顶穿格子就是靠这条抓出来的。
        const clash = []
        const marks = [...document.querySelectorAll('.title,.sub,.bullets,.cols,.col,.note,.url,.kicker,.step,.animbox,.cardpanel')]
          .map((el) => ({ el, b: rect(el) }))
          .filter((m) => m.b.width > 1 && m.b.height > 1)
        for (let a = 0; a < marks.length; a++) {
          for (let c = a + 1; c < marks.length; c++) {
            const A = marks[a], B = marks[c]
            if (A.el.contains(B.el) || B.el.contains(A.el)) continue
            const ox = Math.min(A.b.right, B.b.right) - Math.max(A.b.left, B.b.left)
            const oy = Math.min(A.b.bottom, B.b.bottom) - Math.max(A.b.top, B.b.top)
            if (ox <= 1 || oy <= 1) continue
            const area = ox * oy
            const small = Math.min(A.b.width * A.b.height, B.b.width * B.b.height)
            if (area / small > 0.005) {
              clash.push(
                `${name(A.el)} × ${name(B.el)} 相叠 ${Math.round(ox)}×${Math.round(oy)}px`,
              )
            }
          }
        }

        // 容器被内容顶穿：.fit 只量自己，父级 .cols/.col 溢出 .lay 是查不出来的
        const burst = []
        const lay = document.querySelector('.lay')
        if (lay) {
          const lb = rect(lay)
          for (const el of document.querySelectorAll('.cols,.col,.bullets,.animbox')) {
            const b = rect(el)
            if (b.height && b.bottom > lb.bottom + 1) burst.push(`${name(el)} 超出 .lay 底边 ${Math.round(b.bottom - lb.bottom)}px`)
          }
        }

        // 孤字：大标题折行后末行只剩一两个字。S14 的金句卡就是这么碎成
        // 「Sleep 停脑，Stop 停钟，Standby 断 / 电」的——全片最该被记住的一帧，
        // 排版却是散的。MIN_FONT 那类几何量法抓不到它（字号完全合规），
        // 只能逐字符量行盒：从最后一个可见字符往回数，top 不变的就是末行的字数。
        const widows = []
        for (const el of document.querySelectorAll('.title')) {
          const nodes = []
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
          for (let n; (n = walker.nextNode()); ) if (n.nodeValue.trim()) nodes.push(n)
          if (!nodes.length) continue
          const rg = document.createRange()
          let li = nodes.length - 1
          let pos = nodes[li].nodeValue.trimEnd().length - 1
          const rectAt = (node, i) => {
            rg.setStart(node, i)
            rg.setEnd(node, i + 1)
            return rg.getBoundingClientRect()
          }
          const lastBox = rectAt(nodes[li], pos)
          if (lastBox.width < 1) continue
          // 只有一行的标题不是折行落单，是整句就短——别报。
          const head = nodes[0].nodeValue.length - nodes[0].nodeValue.trimStart().length
          if (Math.abs(rectAt(nodes[0], head).top - lastBox.top) <= 1) continue
          let tail = nodes[li].nodeValue[pos]
          let seen = 0
          while (seen < 6) {
            pos--
            if (pos < 0) {
              li--
              if (li < 0) break
              pos = nodes[li].nodeValue.trimEnd().length - 1
              if (pos < 0) continue
            }
            const b = rectAt(nodes[li], pos)
            if (Math.abs(b.top - lastBox.top) > 1) break
            tail = nodes[li].nodeValue[pos] + tail
            seen++
          }
          if (seen < 2) widows.push(`末行只剩 ${seen + 1} 字「${tail}」：${el.textContent.trim().slice(0, 22)}`)
        }

        let svgNote = ''
        const svgIssues = []
        const svg = document.querySelector('.animbox svg')
        if (svg) {
          const box = rect(svg.parentElement)
          const b = rect(svg)
          const vb = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number)
          const want = vb[2] / vb[3]
          const got = b.width / b.height
          svgNote = `svg ${Math.round(b.width)}×${Math.round(b.height)}`
          if (Math.abs(want - got) / want > 0.01) svgIssues.push(`动画被拉伸（比例 ${got.toFixed(3)}，应为 ${want.toFixed(3)}）`)
          if (b.left < box.left - 1 || b.right > box.right + 1 || b.top < box.top - 1 || b.bottom > box.bottom + 1) {
            svgIssues.push(`动画溢出容器 svg=${Math.round(b.left)},${Math.round(b.top)},${Math.round(b.right)},${Math.round(b.bottom)} box=${Math.round(box.left)},${Math.round(box.top)},${Math.round(box.right)},${Math.round(box.bottom)}`)
          }
        }
        return { overflow, clipped, hit, clash, burst, tooSmall, widows, svgIssues, minFont: minFont === Infinity ? null : minFont, minFontTag, svgNote, fonts: document.fonts.status }
      },
      { index: sc.index, capText: longest.get(sc.id) || null },
    )

    for (const o of r.overflow) issues.push(`${sc.id}: 越出画布 ${o}`)
    for (const c of r.clipped) issues.push(`${sc.id}: 内容被裁 ${c}`)
    for (const hh of r.hit) issues.push(`${sc.id}: 字幕压住 ${hh}`)
    for (const cl of r.clash) issues.push(`${sc.id}: 版式相叠 ${cl}`)
    for (const ts of r.tooSmall) issues.push(`${sc.id}: 字号不可读 ${ts}`)
    for (const bu of r.burst) issues.push(`${sc.id}: ${bu}`)
    // 判据在 13 集成片 × 双平台上跑过一轮：17 处全是真孤字，零误报，所以升成闸。
    // 修法永远是那两个：宽屏在语义接缝补 \n，竖屏把短句再砍短。
    for (const w of r.widows) issues.push(`${sc.id}: 标题${w}（在语义接缝补 \\n 或改短）`)
    for (const s of r.svgIssues) issues.push(`${sc.id}: ${s}`)
    rows.push(
      `  ${String(sc.startFrame / plan.fps).padStart(7)}s  ${sc.id.padEnd(22)} 最小字号 ${
        r.minFont === null ? '-' : `${r.minFont.toFixed(1)}px`
      } ${r.minFontTag}  ${r.svgNote}`,
    )
    log(rows.at(-1))
  }
  // 字体不是看 CSS 写了什么，而是看 Chromium 真正用哪个字族栅格化了这批字。
  // CDP 的 getPlatformFontsForNode 给出实际用的字族 + 栅格化字形数：
  // 字形数为 0 或字族里没有中文字体，屏幕上就是豆腐块。
  const capEl = await stage.page.$('#captext')
  let used = null
  try {
    const cdp = await stage.page.context().newCDPSession(stage.page)
    await cdp.send('DOM.enable')
    await cdp.send('CSS.enable')
    const { root } = await cdp.send('DOM.getDocument', { depth: 1 })
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#captext' })
    used = nodeId ? (await cdp.send('CSS.getPlatformFontsForNode', { nodeId })).fonts : null
    await cdp.detach()
  } catch (e) {
    log(`  ⚠️  字体审计降级（CDP 不可用：${e.message.split('\n')[0]}）`)
  }
  const cjk = (used || []).filter((f) => /yahei|pingfang|noto sans sc|source han|han sans|simsun|hei/i.test(f.familyName))
  const glyphs = (used || []).reduce((a, f) => a + (f.glyphCount || 0), 0)
  if (capEl) await capEl.evaluate((el) => (el.textContent = ''))
  if (used && (!cjk.length || !cjk.some((f) => f.glyphCount > 0))) {
    throw new Error(`中文字体没被真正使用，字幕会成豆腐块。实际栅格化字族：${JSON.stringify(used)}（共 ${glyphs} 个字形）`)
  }
  if (used) log(`  🔤 字幕字族：${cjk.map((f) => `${f.familyName}(${f.glyphCount})`).join(' / ')}`)
  if (issues.length) throw new Error(`排版审计未通过:\n${issues.map((e) => `  - ${e}`).join('\n')}`)
  log(`  🔍 排版审计通过：${plan.scenes.length} 场，越界/裁切/压字幕/版式相叠/字号不可读/顶穿容器/标题孤字 0`)
  return rows
}

// ---------------------------------------------------------------- build

function srtPathOf(outDir) {
  return join(outDir, 'narration.srt')
}

// 验证清单第 5 条：字幕条数与旁白切句一致、时间轴单调、末句不越片尾
function verifySrt(srtFile, timeline, duration) {
  const chunks = readFileSync(srtFile, 'utf8').trim().split(/\n\s*\n/)
  if (chunks.length !== timeline.captions.length) {
    throw new Error(`${srtFile} 有 ${chunks.length} 条字幕，时间轴里是 ${timeline.captions.length} 条`)
  }
  let last = -1
  let end = 0
  for (const [i, ch] of chunks.entries()) {
    const m = ch.match(/(\d\d):(\d\d):(\d\d),(\d\d\d) --> (\d\d):(\d\d):(\d\d),(\d\d\d)/)
    if (!m) throw new Error(`${srtFile} 第 ${i + 1} 条没有时间轴`)
    const t = (a, b, c, d) => Number(a) * 3600 + Number(b) * 60 + Number(c) + Number(d) / 1000
    const s = t(m[1], m[2], m[3], m[4])
    const e = t(m[5], m[6], m[7], m[8])
    if (e <= s) throw new Error(`${srtFile} 第 ${i + 1} 条结束早于开始`)
    if (s < last) throw new Error(`${srtFile} 第 ${i + 1} 条时间倒流：${s} < ${last}`)
    last = s
    end = Math.max(end, e)
  }
  if (end > duration + 0.05) throw new Error(`${srtFile} 末句 ${end.toFixed(2)}s 超出视频时长 ${duration.toFixed(2)}s`)
  log(`  📄 字幕 ${chunks.length} 条，时间轴单调，末句 ${end.toFixed(2)}s ≤ ${duration.toFixed(2)}s`)
  return { count: chunks.length, end }
}

async function buildOne(browser, ep, id, platform, flags) {
  const cfg = platformConfig(ep, platform)
  const scenes = resolveScenes(ep, platform)
  const workDir = ensureDir(join(OUT_DIR, id, platform))
  const distDir = ensureDir(join(OUT_DIR, id))
  const finalVideo = join(distDir, `${platform}.mp4`)
  log(`\n${'━'.repeat(72)}\n🎬 ${id} · ${platform}  ${cfg.size.join('×')} @ ${cfg.fps}fps  ${scenes.length} 场\n${'━'.repeat(72)}`)

  const t0 = Date.now()
  log('① 旁白合成 + 时间轴')
  const timeline = await buildAudio(ep, platform, workDir, { force: !!flags['force-audio'] })
  const plan = buildRenderPlan(ep, platform, timeline)
  log(planSummary(plan))
  const [lo, hi] = cfg.targetSec || []
  if (lo && hi) {
    const secs = plan.totalFrames / plan.fps
    if (secs < lo || secs > hi) throw new Error(`${platform} 成片 ${secs.toFixed(1)}s，不在目标 ${lo}-${hi}s 内`)
  }

  const animScenes = plan.scenes.filter((s) => s.anim)
  if (animScenes.length && !flags['skip-selftest']) {
    log('② seek 自检（前进/后退可复现 + 跨时刻确实在动）')
    await seekSelfTest(browser, { platform, size: cfg.size, anim: animScenes[0].anim })
  }

  log('③ 舞台 + 排版审计')
  const stage = await openStage(browser, {
    platform,
    size: cfg.size,
    safe: cfg.safe,
    scenes,
    kicker: ep.cover?.kicker || '通往单片机之路',
    badge: ep.badge || id.split('-')[0].toUpperCase(),
  })
  const srtFile = srtPathOf(workDir)
  verifySrt(srtFile, timeline, timeline.duration)
  let rendered
  try {
    await auditLayout(stage, plan)
    if (flags.stills) {
      const dir = ensureDir(join(workDir, 'stills'))
      const marks = [0.5, ...plan.scenes.filter((s) => s.anim).map((s) => s.startFrame / plan.fps + s.duration / 2)].slice(0, 6)
      const picked = await captureStills(plan, stage, marks, (name, buf) => writeFileSync(join(dir, `${name}.png`), buf))
      log(`  🖼️  抽帧 ${picked.length} 张 → ${dir}`)
    }
    log(`④ 逐帧渲染 → ${finalVideo}`)
    let next = 0
    rendered = await renderFrames(plan, stage, {
      outPath: join(workDir, 'video.mp4'),
      ffmpeg: FFMPEG,
      onFrame: ({ done, total, shot, reused }) => {
        const now = Date.now()
        if (now < next) return
        next = now + 5000
        process.stdout.write(`\r    ${((done / total) * 100).toFixed(1)}%  ${done}/${total} 帧  截图 ${shot} 复用 ${reused}`)
      },
    })
    process.stdout.write('\n')
  } finally {
    await stage.close()
  }

  log('⑤ 合流（旁白 + BGM ducking + loudnorm）')
  const info = await mux({
    videoPath: join(workDir, 'video.mp4'),
    narrationPath: join(workDir, 'narration.wav'),
    outPath: finalVideo,
    duration: timeline.duration,
    bgm: flags['no-bgm'] ? null : BGM_PATH,
  })
  const drift = Math.abs(info.duration - rendered.frames / plan.fps)
  if (drift > 1 / plan.fps) throw new Error(`${platform} 视频 ${rendered.frames / plan.fps}s 与成片 ${info.duration}s 差 ${drift}s`)

  log('⑥ 封面 + 发布文案')
  const cover = join(distDir, `${platform}-cover.png`)
  const srtOut = join(distDir, `${platform}.srt`)
  copyFileSync(srtFile, srtOut)
  await buildCover(browser, ep, platform, cover)
  const release = writeRelease({
    ep,
    platform,
    outDir: distDir,
    timeline,
    cfg,
    videoPath: finalVideo,
    srtPath: srtOut,
    coverPath: cover,
    sceneTexts: scenes,
  })
  log(`✅ ${platform} 完成：${fmtClock(timeline.duration)}，用时 ${((Date.now() - t0) / 1000).toFixed(0)}s`)
  for (const f of [finalVideo, srtOut, cover, release]) log(`   ${f}`)
  return { id, platform, duration: timeline.duration, frames: rendered.frames }
}

async function cmdBuild(ids, flags) {
  const want = !flags.platform || flags.platform === 'both' ? ['bilibili', 'douyin'] : [flags.platform]
  const targets = pickEpisodes(ids)
  log(`🎞️  产线启动：${targets.join(', ')} × ${want.join('/')}`)
  const results = []
  const browser = await openBrowser()
  try {
    for (const id of targets) {
      const ep = loadEpisode(id)
      for (const platform of want) {
        if (!ep.platforms[platform]) {
          log(`⏭️  ${id} 没有 ${platform} 平台，跳过`)
          continue
        }
        results.push(await buildOne(browser, ep, id, platform, flags))
      }
    }
  } finally {
    await browser.close()
  }
  log(`\n${'━'.repeat(72)}`)
  for (const r of results) log(`✅ ${r.id} · ${r.platform}  ${fmtClock(r.duration)}  ${r.frames} 帧`)
  log(`📦 产物在 ${join(OUT_DIR, targets[0])}`)
  return 0
}

// 只跑「舞台 + 排版审计」，一帧不渲、一句配音都不合成（时间轴必须已存在）。
// 改完 episode.json 想确认版式没塌、孤字有没有犯，用这条：几秒出结果，
// 不用为了看一眼标题折行等两万帧。
async function cmdCheck(ids, flags) {
  const want = !flags.platform || flags.platform === 'both' ? ['bilibili', 'douyin'] : [flags.platform]
  const targets = pickEpisodes(ids)
  const browser = await openBrowser()
  let bad = 0
  try {
    for (const id of targets) {
      const ep = loadEpisode(id)
      for (const platform of want) {
        if (!ep.platforms[platform]) continue
        const tlFile = join(OUT_DIR, id, platform, 'timeline.json')
        if (!existsSync(tlFile)) {
          log(`⏭️  ${id} · ${platform} 还没有时间轴，跳过（check 不合成配音）`)
          continue
        }
        const cfg = platformConfig(ep, platform)
        const scenes = resolveScenes(ep, platform)
        const plan = buildRenderPlan(ep, platform, JSON.parse(readFileSync(tlFile, 'utf8')))
        log(`\n🔎 ${id} · ${platform}  ${cfg.size.join('×')}  ${scenes.length} 场`)
        const stage = await openStage(browser, {
          platform,
          size: cfg.size,
          safe: cfg.safe,
          scenes,
          kicker: ep.cover?.kicker || '通往单片机之路',
          badge: ep.badge || id.split('-')[0].toUpperCase(),
        })
        try {
          await auditLayout(stage, plan)
        } catch (e) {
          bad++
          log(`  ❌ ${e.message.split('\n').slice(0, 12).join('\n')}`)
        } finally {
          await stage.close()
        }
      }
    }
  } finally {
    await browser.close()
  }
  log(bad ? `\n❌ ${bad} 个平台版式未过` : '\n✅ 全部通过')
  return bad ? 1 : 0
}

// ---------------------------------------------------------------- entry

async function main() {
  const { cmd, pos, flags } = parseArgv(process.argv.slice(2))
  mkdirSync(OUT_DIR, { recursive: true })
  if (cmd === 'lint') return cmdLint(pos)
  if (cmd === 'check') return cmdCheck(pos, flags)
  if (cmd === 'build') return cmdBuild(pos, flags)
  if (cmd === 'calib') return runCalibration(flags.anims ? String(flags.anims).split(',') : undefined)
  throw new Error(`未知子命令 "${cmd || '(空)'}"，可用：lint / check / build / calib`)
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`\n❌ ${err.message}`)
    process.exit(1)
  })
