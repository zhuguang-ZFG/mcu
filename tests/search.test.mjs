import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderSearch } from '../scripts/search-render.mjs'
import { createHighlighter } from 'shiki'
import { codeLanguages } from '../docs/.vitepress/code-languages.mjs'

test('search preserves explanatory text and inline names but omits source dumps', () => {
  const md = { render: () => '<h2>I2C</h2><p>Call <code>read_reg</code></p><pre><code>long source</code></pre>' }
  const result = renderSearch('', {}, md)
  assert.match(result, /read_reg/)
  assert.doesNotMatch(result, /long source/)
  assert.equal(renderSearch('', {frontmatter:{search:false}}, md), '')
})
test('linker and gdb code have actual highlighted tokens', async () => {
  const h = await createHighlighter({themes:['github-light'],langs:codeLanguages})
  for (const [lang, code] of [['ld','SECTIONS { .text : { *(.text*) } }'],['gdb','break main\nx/4wx 0x08000000']]) {
    const html=h.codeToHtml(code,{lang,theme:'github-light'})
    assert.match(html, /style="color:/)
  }
  h.dispose()
})
