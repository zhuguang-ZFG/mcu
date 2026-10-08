// 中文搜索分词：MiniSearch 默认按空白/标点切词，一整段中文会被当成 1 个 token，
// 导致只有落在段首的词能靠 prefix 命中——实测搜「寄存器」「总线」「外设」全部 0 结果。
// 这里把连续中文切成二元组（bigram），让任意位置的中文词都能被检索到。
//
// 约束：本函数必须同时用于「构建期建索引」和「浏览器端解析查询」两端，
// 否则索引与查询的分词口径不一致，搜索会整体失效（VitePress 在
// VPLocalSearchBox 与 build 端都读取 themeConfig.search.options.miniSearch.options）。

// CJK 统一表意文字 + 扩展 A + 兼容表意文字 + 日文假名
const CJK = '\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff\\u3040-\\u30ff'

/** 与 MiniSearch 默认一致的切分：空白与 Unicode 标点。 */
const SPACE_OR_PUNCTUATION = /[\n\r\p{Z}\p{P}]+/u

export function isCjk(ch) {
  if (!ch) return false
  const c = ch.codePointAt(0)
  return (
    (c >= 0x3400 && c <= 0x4dbf) ||
    (c >= 0x4e00 && c <= 0x9fff) ||
    (c >= 0xf900 && c <= 0xfaff) ||
    (c >= 0x3040 && c <= 0x30ff)
  )
}

/**
 * 供 MiniSearch 使用的 tokenizer。
 * - 纯 ASCII/拉丁片段：整体保留（保留 GPIO、FreeRTOS、0x40021418 这类标识符的完整性）
 * - 连续中文：切成二元组；单字片段保留单字，否则单字查询会查不到
 * - 中英混排（如 "RCC时钟树"）：按语种切成 R | CC | 时钟 | 钟树
 * @param {string} text
 * @returns {string[]}
 */
export function tokenizeForSearch(text) {
  if (text == null) return []
  const out = []
  for (const seg of String(text).split(SPACE_OR_PUNCTUATION)) {
    if (!seg) continue
    if (!isCjk(seg[0]) && !seg.split('').some(isCjk)) {
      out.push(seg)
      continue
    }
    // 混合段：按语种交替切成 run
    const runs = seg.match(new RegExp(`[${CJK}]+|[^${CJK}]+`, 'g')) || []
    for (const run of runs) {
      if (isCjk(run[0])) {
        if (run.length === 1) {
          out.push(run)
        } else {
          for (let i = 0; i + 2 <= run.length; i++) out.push(run.slice(i, i + 2))
        }
      } else {
        out.push(run)
      }
    }
  }
  return out
}

export default tokenizeForSearch
