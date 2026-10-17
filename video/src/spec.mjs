import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { ANIM_DIR, EPISODES_DIR } from './util.mjs'

export const KINDS = ['hook', 'anim', 'code', 'card', 'outro']
export const SMIL_MODES = ['stretch', 'loop', 'once']

// 旁白时长估算：每字秒数 + 每场固定留白，见下面 validateEpisode 里的回归出处
export const SEC_PER_CHAR = {
  bilibili: { char: 0.1955, perScene: 0 },
  douyin: { char: 0.1946, perScene: 1.091 },
}

export const PLATFORM_DEFAULTS = {
  bilibili: { size: [1920, 1080], fps: 30, safe: { top: 60, right: 60, bottom: 150, left: 60 } },
  douyin: { size: [1080, 1920], fps: 30, safe: { top: 200, right: 160, bottom: 300, left: 100 } },
}

export function episodePath(id) {
  return join(EPISODES_DIR, id, 'episode.json')
}

// 抖音短版常只改旁白（要 60 秒讲完），画面复用 B 站长版，避免两处维护同一批 scene。
// pick 给定时按这个顺序挑，是"同素材重排的短版"而不是把长版调快。
export function resolveScenes(ep, platform) {
  const cfg = ep.platforms[platform]
  if (!cfg) throw new Error(`episode 里没有平台 ${platform}`)
  if (cfg.scenes) return cfg.scenes
  if (cfg.reuseFrom) {
    const src = ep.platforms[cfg.reuseFrom]
    if (src?.scenes) {
      const overrides = cfg.narration || {}
      const sets = cfg.set || {}
      const byId = new Map(src.scenes.map((sc) => [sc.id, sc]))
      const list = cfg.pick ? cfg.pick.map((sid) => byId.get(sid) ?? { id: sid, __missing: true }) : src.scenes
      // set 按字段覆盖任意一项。竖屏放不下横版那条 120 字符的取证输出、也放不下
      // 不断行的 19 字大标题，只能让抖音带一份自己的 code/title——
      // 而不是把 scene 整份复制出来两处维护。
      return list.map((sc) => {
        const out = overrides[sc.id] ? { ...sc, narration: overrides[sc.id] } : { ...sc }
        return sets[sc.id] ? { ...out, ...sets[sc.id] } : out
      })
    }
    throw new Error(`平台 ${platform}: reuseFrom="${cfg.reuseFrom}" 没有 scenes`)
  }
  throw new Error(`平台 ${platform}: 既没有 scenes 也没有可用的 reuseFrom`)
}

function check(cond, msg, errs) {
  if (!cond) errs.push(msg)
}

// 页头「第 i/n 节 · title」的数据源。platforms[p].sections 声明分节边界，
// `at` 是该场第一幕的 scene id，一节管到下一节开始为止。
// 缺省返回全 null——旧稿没有这个字段时，页头必须与改版前逐字节相同（回归口径）。
// 首节之前的场次（比如没归进任何一节的片头）也是 null，页头保持旧文案。
export function sceneSections(scenes, sections) {
  if (!sections?.length) return scenes.map(() => null)
  const byScene = new Map(sections.map((s, j) => [s.at, j]))
  const n = sections.length
  let k = -1
  return scenes.map((sc) => {
    const j = byScene.get(sc.id)
    if (j !== undefined) k = j
    return k < 0 ? null : { i: k + 1, n, title: sections[k].title }
  })
}

// 12 字是页头字号（1.7u≈18.4px）下竖版 860px 可用宽的实测上限，不是拍脑袋：
// 改版后 fill-probe 会量出真实占宽，宽度不够就先减字、不是先缩字号——
// 页头一缩字号就撞审计的 16px 地板。
export const SECTION_TITLE_MAX = 12

function validateSections(sections, scenes, name, errs) {
  if (!sections?.length) return
  const seenAt = new Set()
  let lastIdx = -1
  for (const [j, s] of sections.entries()) {
    const at = `${name}.sections[${j}]`
    const idx = scenes.findIndex((sc) => sc.id === s.at)
    // 命不中真实 id、顺序乱是写错稿。静默退回旧页头会把错误一路带到成片里，
    // 而页头文本每帧都在画面中，错了没有第二处能看出来。
    check(idx >= 0, `${at}: at="${s.at}" 不是平台 ${name} 里的真实 scene id`, errs)
    check(!seenAt.has(s.at), `${at}: at="${s.at}" 与其它节重复`, errs)
    seenAt.add(s.at)
    check(s.title?.trim(), `${at}: 缺 title`, errs)
    const len = s.title?.trim().length || 0
    check(len <= SECTION_TITLE_MAX, `${at}: title ${len} 字，超过页头宽度上限 ${SECTION_TITLE_MAX} 字（先减字，别指望 fitAll 缩字号）`, errs)
    if (idx >= 0) {
      check(idx > lastIdx, `${at}: at="${s.at}" 在 scenes 里是第 ${idx} 场，不大于上一节的 ${lastIdx}（分节必须按场次递增）`, errs)
      lastIdx = idx
    }
  }
}

export function validateEpisode(ep, id) {
  const errs = []
  const warns = []
  check(ep.id === id, `episode.json 的 id="${ep.id}" 与目录名 "${id}" 不一致`, errs)
  check(ep.title?.trim(), '缺 title', errs)
  check(ep.voice?.trim(), '缺 voice（edge-tts 音色名）', errs)
  check(Array.isArray(ep.platforms) === false && ep.platforms, '缺 platforms', errs)

  const seenAnims = new Set()
  for (const [name, cfg] of Object.entries(ep.platforms || {})) {
    if (!PLATFORM_DEFAULTS[name]) warns.push(`未知平台 "${name}"，将套用默认布局字段`)
    let scenes
    try {
      scenes = resolveScenes(ep, name)
    } catch (e) {
      errs.push(e.message)
      continue
    }
    const [w, h] = cfg.size || PLATFORM_DEFAULTS[name]?.size || []
    check(w && h, `平台 ${name}: size 缺失`, errs)

    const ids = new Set()
    let narrationChars = 0
    for (const [i, sc] of scenes.entries()) {
      const at = `${name}.scenes[${i}]${sc.id ? `(${sc.id})` : ''}`
      check(!sc.__missing, `${at}: pick 里的场景在 ${cfg.reuseFrom} 里不存在`, errs)
      check(sc.id?.trim(), `${at}: 缺 id`, errs)
      check(!ids.has(sc.id), `${at}: id 重复`, errs)
      ids.add(sc.id)
      check(KINDS.includes(sc.kind), `${at}: kind="${sc.kind}" 不在 ${KINDS.join('/')}`, errs)
      const text = sc.narration?.trim()
      check(text, `${at}: 缺 narration`, errs)
      narrationChars += text?.length || 0
      if (sc.anim) {
        check(existsSync(join(ANIM_DIR, `${sc.anim}.svg`)), `${at}: 动画 docs/public/anim/${sc.anim}.svg 不存在`, errs)
        seenAnims.add(sc.anim)
        check(
          !sc.t1 || !sc.t0 || sc.t1 > sc.t0,
          `${at}: t1(${sc.t1}) 必须大于 t0(${sc.t0})`,
          errs,
        )
      } else {
        check(!sc.t0 && !sc.t1, `${at}: 没绑 anim 却给了 t0/t1`, errs)
      }
      if (sc.smil) check(SMIL_MODES.includes(sc.smil), `${at}: smil="${sc.smil}" 不在 ${SMIL_MODES.join('/')}`, errs)
      if (sc.kind === 'anim') check(sc.anim, `${at}: kind=anim 但没绑 anim`, errs)
      if (sc.kind === 'code') check(sc.code?.trim(), `${at}: kind=code 但没给 code`, errs)
      if (sc.kind === 'card') check(sc.title?.trim(), `${at}: kind=card 但没给 title`, errs)
      check(sc.tail === undefined || (sc.tail >= 0 && sc.tail <= 3), `${at}: tail 必须在 0..3`, errs)
      // revealFrames 是"这一场开头淡入几帧"，0 = 首帧即全亮；非负整数以外没有意义
      check(
        sc.revealFrames === undefined || (Number.isInteger(sc.revealFrames) && sc.revealFrames >= 0),
        `${at}: revealFrames 必须是非负整数`,
        errs,
      )

      if (h && w) {
        const maxLines = Math.max(6, Math.floor((h * 0.5) / (h * 0.038)))
        const lines = (sc.code || '').split('\n').length
        check(lines <= maxLines + 6, `${at}: 代码 ${lines} 行，超出 ${name} 可显示上限，请拆场`, warns)
      }
    }
    validateSections(cfg.sections, scenes, name, errs)
    const [lo, hi] = cfg.targetSec || []
    if (lo && hi) {
      // 口径来自 11 集成片的实测回归（拿 narration.srt 末句时间当分母，最小二乘拟合）：
      //   bilibili  0.1955 s/字，场次系数 −0.09 ≈ 0        → MAE 10.3 s
      //   douyin    0.1946 s/字 + 1.091 s/场（短旁白下句间留白才显形）→ MAE 1.3 s
      // 同一音色同一 rate 每字耗时一致，差的是固定留白在长短旁白里的占比。
      const rate = SEC_PER_CHAR[name] || SEC_PER_CHAR.bilibili
      const est = narrationChars * rate.char + scenes.length * rate.perScene
      check(
        est >= lo * 0.85 && est <= hi * 1.12,
        `平台 ${name}: 旁白 ${narrationChars} 字 / ${scenes.length} 场 ≈ ${Math.round(est)}s，偏离目标 ${lo}-${hi}s 太多`,
        errs,
      )
    }
  }
  return { errs, warns, anims: [...seenAnims] }
}

export function loadEpisode(id) {
  const p = episodePath(id)
  if (!existsSync(p)) throw new Error(`找不到 ${p}`)
  const ep = JSON.parse(readFileSync(p, 'utf8'))
  const { errs, warns, anims } = validateEpisode(ep, id)
  for (const w of warns) console.warn(`⚠️  ${w}`)
  if (errs.length) {
    throw new Error(`episode.json 校验未通过:\n${errs.map((e) => `  - ${e}`).join('\n')}`)
  }
  return ep
}

export function platformConfig(ep, platform) {
  const base = PLATFORM_DEFAULTS[platform] || { size: [1920, 1080], fps: 30, safe: { top: 40, right: 40, bottom: 40, left: 40 } }
  const cfg = ep.platforms[platform]
  if (!cfg) throw new Error(`episode 里没有平台 ${platform}`)
  return {
    ...base,
    ...cfg,
    size: cfg.size || base.size,
    fps: cfg.fps || ep.fps || base.fps,
    safe: { ...base.safe, ...(cfg.safe || {}) },
  }
}
