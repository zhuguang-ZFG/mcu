/**
 * 性能预算闸门：把「快」从口号变成可执行、可回归的证据。
 *
 * 为什么单独有它：scripts/measure-site.mjs 能测首屏与搜索延迟，但它要启动浏览器与
 * 预览服务器（CI 里也得先装 Playwright），跑不进 `npm run quality` 这条快线，于是
 * 体积回退一直没人守——多引一个库、多塞一张大图，谁也不会响。
 * 这里只做纯静态的体积核算（zlib，无浏览器、无网络），盯住三件最影响体验的事：
 *   1. 站点外壳 + CSS：每个访客都要付的固定成本；
 *   2. 渲染阻塞 CSS 总量；
 *   3. 最大单块（当前是懒加载的搜索索引）——防止某块无限膨胀。
 *
 * 用法：node scripts/perf-budget.mjs（需先 npm run docs:build；--json 输出机器可读）
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 预算（字节）。基线见 PRD；留出余量，只拦真实回退。 */
export const BUDGETS = {
  shellBr: 110 * 1024, // 外壳(app+theme+framework) + CSS 的 brotli 总量
  cssBr: 35 * 1024, // 渲染阻塞 CSS（brotli）
  // 最大单块与搜索索引的基线在 2026-10-08 因「中文分词」上调：
  // MiniSearch 默认按空白/标点切词，整段中文被当成 1 个 token，只有段首词能被
  // prefix 命中——实测搜「优先级反转」「上下文切换」「链接脚本」全部 0 结果。
  // 改为对连续中文切二元组后这三类查询才有结果，代价是索引 br 391→507 KB、
  // 原文 2047→2979 KB。索引是按需懒加载的（用户首次搜索才下载），
  // 换中文搜索真正可用，这笔体积值得付。下调前请先确认中文搜索仍能命中。
  largestChunkBr: 560 * 1024, // 最大单块（brotli），当前为搜索索引
  searchIndexRaw: 3200 * 1024, // 搜索索引原文（懒加载，但有上限）
}

const KB = (n) => (n / 1024).toFixed(1)

export function sizeOf(buf) {
  return {
    raw: buf.length,
    gzip: zlib.gzipSync(buf).length,
    brotli: zlib.brotliCompressSync(buf).length,
  }
}

/** 递归收集产物中的 .js/.css，附 raw/gzip/brotli。 */
export function collectAssets(distDir) {
  const out = []
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, e.name)
      if (e.isDirectory()) walk(abs)
      else if (/\.(js|css)$/.test(e.name)) {
        out.push({ file: path.relative(distDir, abs).replace(/\\/g, '/'), ...sizeOf(fs.readFileSync(abs)) })
      }
    }
  }
  walk(distDir)
  return out.sort((a, b) => b.raw - a.raw)
}

/** 从 index.html 抽取首屏实际引用的 js/css（script src、modulepreload、stylesheet）。 */
export function shellAssets(html) {
  const set = new Set()
  const re = /(?:href|src)="[^"]*?\/assets\/([^"]+\.(?:js|css))"/g
  let m
  while ((m = re.exec(html))) set.add('assets/' + m[1])
  return [...set]
}

/** 依据预算评估：返回 { summary, breaches }。breaches 为空即通过。 */
export function evaluate({ assets, shell, budgets = BUDGETS }) {
  const byFile = new Map(assets.map((a) => [a.file, a]))
  const shellRows = shell.map((f) => byFile.get(f)).filter(Boolean)
  const css = assets.filter((a) => a.file.endsWith('.css'))
  const search = assets.find((a) => /localSearchIndex/i.test(a.file))

  const shellBr = shellRows.reduce((s, a) => s + a.brotli, 0)
  const cssBr = css.reduce((s, a) => s + a.brotli, 0)
  const largest = assets.reduce((m, a) => (a.brotli > m.brotli ? a : m), { file: '-', brotli: 0 })
  const searchRaw = search ? search.raw : 0

  const checks = [
    { key: 'shellBr', label: `首屏外壳+CSS (br)`, value: shellBr, limit: budgets.shellBr },
    { key: 'cssBr', label: `渲染阻塞 CSS (br)`, value: cssBr, limit: budgets.cssBr },
    { key: 'largestChunkBr', label: `最大单块 ${largest.file} (br)`, value: largest.brotli, limit: budgets.largestChunkBr },
    { key: 'searchIndexRaw', label: `搜索索引原文`, value: searchRaw, limit: budgets.searchIndexRaw },
  ]
  const breaches = checks
    .filter((c) => c.value > c.limit)
    .map((c) => ({ ...c, over: c.value - c.limit }))
  return { summary: { checks, shellFiles: shellRows.map((a) => a.file), assets: assets.length }, breaches }
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (isMain) {
  const dist = path.join(ROOT, 'docs', '.vitepress', 'dist')
  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    console.error('✗ 找不到构建产物 docs/.vitepress/dist —— 请先运行 npm run docs:build')
    process.exit(1)
  }
  const assets = collectAssets(dist)
  const shell = shellAssets(fs.readFileSync(path.join(dist, 'index.html'), 'utf8'))
  const { summary, breaches } = evaluate({ assets, shell })

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ summary, breaches }, null, 2))
  } else {
    for (const c of summary.checks) {
      const mark = c.value > c.limit ? '✗' : '✓'
      console.log(`${mark} ${c.label.padEnd(34)} ${KB(c.value).padStart(8)} KB / ${KB(c.limit).padStart(7)} KB`)
    }
  }

  if (breaches.length) {
    console.error(`\n✗ ${breaches.length} 项超出性能预算：`)
    for (const b of breaches) console.error(`  - ${b.label} 超 ${KB(b.over)} KB`)
    console.error('  修复：检查最近引入的依赖/大资源；确属合理增长再上调 BUDGETS 并说明原因。')
    process.exit(1)
  }
  if (!process.argv.includes('--json') && !process.argv.includes('--quiet')) {
    console.log(`\n✓ 性能预算全部通过（${summary.assets} 个 js/css 资源）`)
  }
}
