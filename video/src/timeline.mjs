import { animDuration, readAnim } from '../../docs/.vitepress/anim-decorate.mjs'
import { resolveScenes } from './spec.mjs'

// SMIL 时长来自 anim-decorate 的同一份解析逻辑（主循环 = 最大的那个 dur=）。
// 它返回字符串，这里统一成数字；拿不到就退化成"整段静止"。
export function masterDuration(name) {
  if (!name) return 0
  const raw = readAnim(name)
  const nums = [...raw.matchAll(/dur="([\d.]+)s"/g)].map((m) => Number(m[1])).filter((n) => n > 0)
  return nums.length ? Math.max(...nums) : Number(animDuration(raw)) || 0
}

function smilAt(mode, rel, sceneDur, t0, span) {
  if (mode === 'loop') return t0 + (rel % span)
  if (mode === 'once') return Math.min(t0 + span, t0 + rel)
  return t0 + (sceneDur > 0 ? rel / sceneDur : 0) * span
}

export function buildRenderPlan(ep, platform, timeline) {
  const scenes = resolveScenes(ep, platform)
  if (scenes.length !== timeline.scenes.length) {
    throw new Error(`时间轴场景数 ${timeline.scenes.length} 与 episode 的 ${scenes.length} 不一致，请重跑音频阶段`)
  }
  const fps = timeline.fps
  const plan = { platform, fps, totalFrames: timeline.totalFrames, scenes: [], captions: timeline.captions }

  scenes.forEach((sc, i) => {
    const ts = timeline.scenes[i]
    if (ts.id !== sc.id) throw new Error(`时间轴第 ${i} 项是 ${ts.id}，episode 里是 ${sc.id}`)
    const master = masterDuration(sc.anim)
    const t0 = master ? Math.min(sc.t0 || 0, master) : 0
    const t1 = master ? Math.min(sc.t1 || master, master) : 0
    plan.scenes.push({
      ...sc,
      index: i,
      startFrame: Math.round(ts.start * fps),
      frames: ts.frames,
      duration: ts.duration,
      anim: sc.anim || null,
      master,
      smilT0: t0,
      smilSpan: Math.max(0, t1 - t0),
      smilMode: sc.smil || (sc.anim ? 'stretch' : null),
    })
  })

  for (const sc of plan.scenes) {
    if (sc.anim && !sc.master) throw new Error(`场景 ${sc.id}: 读不到 ${sc.anim} 的 SMIL 时长`)
    if (sc.anim && sc.smilSpan <= 0) throw new Error(`场景 ${sc.id}: ${sc.anim} 的 t0/t1 区间为空，动画不会动`)
  }
  return plan
}

// 逐帧状态：渲染循环按场景推进，captionIdx 用游标避免每帧二分。
export function* iterateFrames(plan) {
  let captionIdx = 0
  for (const sc of plan.scenes) {
    for (let f = 0; f < sc.frames; f++) {
      const abs = (sc.startFrame + f) / plan.fps
      while (captionIdx < plan.captions.length - 1 && plan.captions[captionIdx].end <= abs) captionIdx++
      const cap = plan.captions[captionIdx]
      yield {
        scene: sc,
        frameInScene: f,
        rel: f / plan.fps,
        abs,
        smilTime: sc.anim ? smilAt(sc.smilMode, f / plan.fps, sc.duration, sc.smilT0, sc.smilSpan) : null,
        caption: cap && cap.start <= abs && abs < cap.end ? cap : null,
        captionIdx: cap && cap.start <= abs && abs < cap.end ? captionIdx : -1,
      }
    }
  }
}

export function planSummary(plan) {
  const secs = plan.totalFrames / plan.fps
  const lines = plan.scenes.map(
    (s) => `  ${String(s.startFrame / plan.fps).padStart(7)}s +${s.duration.toFixed(2).padStart(6)}s  ${s.id.padEnd(24)}${s.anim ? ` ${s.anim} [${s.smilMode}]` : ''}`,
  )
  return [`📐 ${plan.platform}: ${plan.scenes.length} 个场景，${plan.totalFrames} 帧，${secs.toFixed(2)}s`, ...lines].join('\n')
}
