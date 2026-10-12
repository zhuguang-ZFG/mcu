import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { FFMPEG, VIDEO_ROOT, ensureDir, fmtSec, log, probeStreams, run } from './util.mjs'

export const BGM_PATH = join(VIDEO_ROOT, 'assets', 'ambient-pad.m4a')

// 旁白是主角：BGM 先压到很低的底，再用 sidechaincompress 让旁白一开口就把它压下去，
// 旁白停顿的间隙它自己抬回来（makeup 不做，避免呼吸感太明显）。
// 最后 loudnorm 到 -14 LUFS——B站/抖音的通行响度，也是手机外放不难听的下限。
// loudnorm 内部会把采样率顶到 192k，尾巴上必须补一道 aresample。
function audioFilter({ bgm, duck }) {
  if (!bgm) return 'loudnorm=I=-14:TP=-1.5:LRA=11,aresample=44100[out]'
  // sidechaincompress 会吃掉它的两个输入，只吐一路"被压过的 BGM"。
  // 旁白要同时当触发源和主声，必须先 asplit 成两路，否则 amix 拿到的标签已被消费，
  // ffmpeg 直接报 "Stream matching for 'narr' has no matches"。
  const head = duck
    ? [
        '[1:a]aresample=44100,asplit=2[narr][narrSC]',
        '[2:a]aresample=44100,volume=-16dB[bg]',
        '[bg][narrSC]sidechaincompress=threshold=0.03:ratio=6:attack=25:release=350[ducked]',
        '[narr][ducked]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[mix]',
      ]
    : [
        '[1:a]aresample=44100[narr]',
        '[2:a]aresample=44100,volume=-16dB[bg]',
        '[narr][bg]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[mix]',
      ]
  return [...head, '[mix]loudnorm=I=-14:TP=-1.5:LRA=11,aresample=44100[out]'].join(';')
}

// 视频流是 -c:v copy 直接搬过去：逐帧渲染阶段已经把时长钉死在 totalFrames/fps，
// 这里再断言一次成片两条流的时长差，音画对位到此有证据。
export async function mux({ videoPath, narrationPath, outPath, duration, bgm = BGM_PATH, duck = true }) {
  const useBgm = bgm && existsSync(bgm)
  ensureDir(outPath.replace(/[\\/][^\\/]+$/, ''))
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', videoPath, '-i', narrationPath]
  if (useBgm) args.push('-stream_loop', '-1', '-i', bgm)
  args.push(
    '-filter_complex',
    audioFilter({ bgm: useBgm, duck }),
    '-map',
    '0:v:0',
    '-map',
    '[out]',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-ar',
    '44100',
    '-ac',
    '2',
    '-t',
    duration.toFixed(6),
    '-shortest',
    '-movflags',
    '+faststart',
    outPath,
  )
  await run(FFMPEG, args)

  const info = await probeStreams(outPath)
  const drift = Math.abs(info.duration - duration)
  if (drift > 0.15) throw new Error(`${outPath} 成片时长 ${info.duration.toFixed(3)}s 与计划 ${duration.toFixed(3)}s 差 ${drift.toFixed(3)}s`)
  if (!info.video) throw new Error(`${outPath} 里没有视频流`)
  if (info.audio?.codec !== 'aac' || info.audio?.sampleRate !== 44100 || info.audio?.channels !== 2) {
    throw new Error(`${outPath} 音轨不是 aac 44.1kHz 立体声：${info.audio?.line}`)
  }
  log(
    `  🔊 成片 ${fmtSec(info.duration)}｜${useBgm ? 'BGM ducking' : '纯旁白'}｜` +
      `视频 ${info.video.replace(/^\s*/, '')}｜音频 ${info.audio.codec}/${info.audio.sampleRate}Hz/${info.audio.channels}ch`,
  )
  return info
}
