// 搜索正文、标题、行内标识符和图注；完整源码已可在章节内查阅，
// 不重复索引大量导入代码与 SVG 序列化数据。
export function renderSearch(src, env, md) {
  const html = md.render(src, env)
  if (env.frontmatter?.search === false) return ''
  return html.replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/gi, '')
}
