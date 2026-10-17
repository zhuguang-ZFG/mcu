// 小红书视频笔记的分步驱动：连 video/publish/xhs-daemon.mjs 起的那个常驻浏览器（9223），一次只做一步。
// 为什么分步而不是一把梭：发布是不可逆的公开动作，而编辑器里的状态（选好的视频、填好的字）
// 只活在那一页上——脚本一退、标签页一关就得重传。所以本驱动**绝不关掉工作标签页**，
// 也绝不在 CDP 连接上调 browser.close()（红线：会把登录态所在的窗口一起带走）。
// 事实源纪律：一集的字只从 video/episodes/<ep>/episode.json 的 publish.xiaohongshu 与 video/out/<ep>/ 来，
// 脚本里不写任何一集的字面量。
import { chromium } from 'playwright'
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'

const RUN = 'D:/Users/mcu/.temp/xhs-run'
mkdirSync(RUN, { recursive: true })
const PUBLISH_URL = 'https://creator.xiaohongshu.com/publish/publish?target=video'
const WORK_HOST = '/publish/publish'

const verb = process.argv[2]
function arg(name, dflt = null) {
  const i = process.argv.findIndex((a) => a === name || a.startsWith(`${name}=`))
  if (i < 0) return dflt
  const a = process.argv[i]
  return a.includes('=') ? a.slice(a.indexOf('=') + 1) || dflt : process.argv[i + 1] ?? dflt
}
const EP = arg('--ep')
if (!EP) throw new Error('缺 --ep <episode-id>（--ep x 和 --ep=x 都认）——不猜这是哪一集')

const epFile = `D:/Users/mcu/video/episodes/${EP}/episode.json`
if (!existsSync(epFile)) throw new Error(`没有这一集：${epFile}`)
const ep = JSON.parse(readFileSync(epFile, 'utf8'))
const VIDEO = `D:/Users/mcu/video/out/${EP}/douyin.mp4`
const COVER = `D:/Users/mcu/video/out/${EP}/douyin-cover.png`

const browser = await chromium.connectOverCDP('http://127.0.0.1:9223')
const ctx = browser.contexts()[0]
// comment 走的是网页版（www.xiaohongshu.com），不是创作者中心那页编辑器，所以不参与工作页认领。
const WEB_ONLY = verb === 'comment'
let page = null
if (!WEB_ONLY) {
  // 工作标签页按 URL 认领：已开着编辑器就回来接着用，没有就新开一页。
  // 新开而不是复用常驻页——上一版探针就是因为关掉常驻页把整个浏览器带没了。
  page = ctx.pages().find((p) => p.url().includes(WORK_HOST))
  if (!page) {
    page = await ctx.newPage()
    await page.goto(PUBLISH_URL, { waitUntil: 'domcontentloaded' })
  }
  page.setDefaultTimeout(120_000)
}

async function dump(label) {
  const info = await page.evaluate(() => {
    const txt = (s) => (s || '').replace(/\s+/g, ' ').trim()
    const fields = [...document.querySelectorAll('input,textarea,[contenteditable="true"]')].map((el) => {
      const r = el.getBoundingClientRect()
      return {
        sel: el.tagName.toLowerCase() + (el.getAttribute('contenteditable') ? '[contenteditable]' : ''),
        type: el.getAttribute('type') || null,
        ph: el.getAttribute('placeholder') || null,
        max: el.getAttribute('maxlength') || null,
        accept: el.getAttribute('accept') || null,
        cls: (el.getAttribute('class') || '').slice(0, 42),
        text: txt(el.value ?? el.innerText).slice(0, 40),
        visible: !!(r.width && r.height),
      }
    })
    const counters = [...new Set(document.body.innerText.match(/\d+\s*\/\s*\d{1,5}/g) || [])]
    const hints = []
    for (const el of document.querySelectorAll('[class*="limit"],[class*="count"],[class*="tip"],small,em')) {
      const t = txt(el.innerText)
      if (t && t.length <= 60 && /\d/.test(t) && !hints.includes(t)) hints.push(t)
    }
    const buttons = []
    for (const b of document.querySelectorAll('button,[role="button"],div[class*="btn"],span[class*="btn"]')) {
      const t = txt(b.innerText)
      if (!t || t.length > 16) continue
      const r = b.getBoundingClientRect()
      if (r.width && r.height && !buttons.includes(t)) buttons.push(t)
    }
    return { url: location.href, title: document.title, fields, counters, hints: hints.slice(0, 25), buttons, body: txt(document.body.innerText).slice(0, 1200) }
  })
  console.log(`\n【${label}】${info.url}`)
  console.log(`  字段（${info.fields.length}）：`)
  for (const f of info.fields) {
    console.log(`    ${f.sel}${f.type ? `:${f.type}` : ''} ph=「${f.ph || ''}」 max=${f.max || '-'}${f.accept ? ` accept=${f.accept}` : ''}${f.visible ? '' : ' [隐藏]'}${f.text ? ` 现值=「${f.text}」` : ''} class=${f.cls}`)
  }
  console.log(`  计数器：${info.counters.join(' | ') || '无'}`)
  console.log(`  带数字的提示：${info.hints.join(' | ') || '无'}`)
  console.log(`  按钮：${info.buttons.join(' | ')}`)
  console.log(`  正文前 1200 字：${info.body}`)
  return info
}

// 这个页面是 SPA：domcontentloaded 时正文还是空的，直接 dump 会打出"字段 0 / 正文空"，
// 看着像通道挂了其实是没等。等到出现可交互的上传/编辑控件再读，等不到也继续（把真实状态打出来）。
async function settle(ms = 45_000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    const ready = await page
      .evaluate(() => !!document.querySelector('input[type=file],[contenteditable="true"],textarea'))
      .catch(() => false)
    if (ready) {
      await page.waitForTimeout(1500)
      return true
    }
    await page.waitForTimeout(1500)
  }
  return false
}

if (verb === 'status') {
  await settle()
  await dump('status')
} else if (verb === 'open') {
  await page.goto(PUBLISH_URL, { waitUntil: 'domcontentloaded' })
  await settle()
  await dump('open')
} else if (verb === 'upload') {
  if (!existsSync(VIDEO)) throw new Error(`没有成片：${VIDEO}`)
  if (!existsSync(COVER)) throw new Error(`没有封面：${COVER}`)
  console.log(`上传成片 ${VIDEO}（${(statSize(VIDEO) / 1e6).toFixed(2)} MB）——只进编辑器，不点发布`)
  await page.setInputFiles('input[type=file]', VIDEO)
  await page.waitForTimeout(30_000)
  await dump('upload')
  await page.screenshot({ path: `${RUN}/${EP}-after-upload.png` })
} else if (verb === 'measure') {
  // 上限只能自己量：页面上标题框没有 maxlength 属性，正文计数器印的是 0/1000，
  // 抄别人的数字（或按别的平台上限写死）会把第一次试发变成废稿。
  const TITLE = '标题字数上限实测：一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十'
  await page.fill('input[placeholder="填写标题会有更多赞哦"]', TITLE)
  await page.waitForTimeout(1200)
  const t = await page.evaluate((s) => {
    const el = document.querySelector('input[placeholder="填写标题会有更多赞哦"]')
    const box = el?.closest('div')?.parentElement
    return { typed: s.length, value: (el?.value || '').length, near: (box?.innerText || '').replace(/\s+/g, ' ').slice(0, 120) }
  }, TITLE)
  console.log(`\n【标题】喂进 ${t.typed} 字 → 留在框里 ${t.value} 字；框旁文案：「${t.near}」`)
  const BODY = '正文上限实测。'.repeat(200)
  await page.click('.tiptap.ProseMirror')
  await page.keyboard.insertText(BODY)
  await page.waitForTimeout(1500)
  const b = await page.evaluate(() => {
    const ed = document.querySelector('.tiptap.ProseMirror')
    const counters = [...new Set((document.body.innerText.match(/\d+\s*\/\s*\d{1,5}/g) || []))]
    return { kept: (ed?.innerText || '').replace(/\s/g, '').length, counters }
  })
  console.log(`【正文】喂进 ${BODY.replace(/\s/g, '').length} 字 → 编辑器里剩 ${b.kept} 字；计数器：${b.counters.join(' | ')}`)
  await page.screenshot({ path: `${RUN}/measure.png` })
  console.log(`  截图：${RUN}/measure.png`)
} else if (verb === 'fill') {
  const xs = ep.publish?.xiaohongshu
  if (!xs) throw new Error(`${EP} 的 episode.json 没有 publish.xiaohongshu——不替这一集猜文案`)
  // 护栏写在本机这一侧：实测这两个上限都**不在 DOM 上强制**（标题框没有 maxlength，
  // 正文 1400 字照样进编辑器），页面只把 "39 / 20"、"1400 /1000" 印成红色分母，
  // 拦住的是提交而不是输入。所以越界必须在这里死掉，不能指望平台替我们拦。
  const TITLE_MAX = 20
  const BODY_MAX = 1000
  const errs = []
  const cps = (s) => [...s].length
  if (cps(xs.title) > TITLE_MAX) errs.push(`标题 ${cps(xs.title)} 字 > ${TITLE_MAX}`)
  if (cps(xs.body) > BODY_MAX) errs.push(`正文 ${cps(xs.body)} 字 > ${BODY_MAX}`)
  for (const [k, v] of [['title', xs.title], ['body', xs.body], ['pinned', xs.pinned || '']]) {
    if (/https?:\/\//.test(v)) errs.push(`${k} 里有站外链接`)
    if (/github/i.test(v)) errs.push(`${k} 里有 GitHub 字样`)
  }
  if (errs.length) {
    console.log('停在填写前：')
    for (const e of errs) console.log(`  - ${e}`)
    process.exit(2)
  }
  await page.fill('input[placeholder="填写标题会有更多赞哦"]', xs.title)
  await page.click('.tiptap.ProseMirror')
  await page.keyboard.press('Control+a')
  await page.keyboard.press('Delete')
  const paras = xs.body.split('\n')
  for (let k = 0; k < paras.length; k++) {
    if (k) await page.keyboard.press('Enter')
    if (paras[k]) await page.keyboard.insertText(paras[k])
  }
  await page.waitForTimeout(1500)
  const back = await page.evaluate(() => {
    const t = document.querySelector('input[placeholder="填写标题会有更多赞哦"]')
    const ed = document.querySelector('.tiptap.ProseMirror')
    // 计数器只认"整个元素就是一串 a / b"的那种节点。上一版拿全页 innerText 正则扫，
    // 把稿件正文里那句「（6000 / 2500）」也读进来了——看着是页面在报数，其实是我们自己写的字。
    const counters = []
    for (const el of document.querySelectorAll('*')) {
      const own = (el.innerText || '').replace(/\s+/g, ' ').trim()
      if (/^[\d,]+\s*\/\s*[\d,]+$/.test(own)) {
        const r = el.getBoundingClientRect()
        if (r.width && r.height && !counters.includes(own)) counters.push(own)
      }
    }
    return {
      title: [...(t?.value || '')].length,
      body: [...(ed?.innerText || '').replace(/\s+/g, '')].length,
      counters,
    }
  })
  console.log(`\n【fill】标题回填 ${back.title} 字（目标 ${cps(xs.title)}）；正文编辑器内 ${back.body} 字（去空白）；计数器：${back.counters.join(' | ')}`)
  if (back.title !== cps(xs.title)) console.log(`  ⚠ 标题字数与稿件不一致，看截图再决定继不继续`)
  if (back.counters.some((c) => /^\s*0\s*\/\s*0/.test(c))) console.log('  ⚠ 计数器像是空的，填写可能没落到编辑器上')
  await page.screenshot({ path: `${RUN}/${EP}-filled.png` })
  console.log(`  截图：${RUN}/${EP}-filled.png`)
} else if (verb === 'topics') {
  // 话题必须是 chip，不是正文里的黑字：实测把 "#FreeRTOS #互斥锁" 直接写进正文，截图上就是普通文本，
  // 只有输入 "#名字" 之后弹出来的那条候选（带「1758浏览」）接住才算挂上话题。
  // 接法用回车，不用 locator 点候选：上一版 `text=/^#FreeRTOS/` 先匹配到的正是刚打进正文的那串黑字，
  // 点它只是移动光标，三次"clicked"最后拼出 "#优先" + "级反转斥锁RTOS" 这种交错垃圾（HTML 尾巴为证）。
  const list = ep.publish?.xiaohongshu?.topics || []
  if (!list.length) throw new Error(`${EP} 没有 publish.xiaohongshu.topics，不替这一集猜话题`)
  await page.click('.tiptap.ProseMirror')
  await page.keyboard.press('Control+End')
  for (const t of list) {
    await page.keyboard.insertText(` #${t}`)
    await page.waitForTimeout(2200)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(900)
    const st = await page.evaluate(() => {
      const ed = document.querySelector('.tiptap.ProseMirror')
      const nodes = [...ed.querySelectorAll('a,[class*="topic"],[data-type]')].map((el) => `${el.tagName.toLowerCase()}.${el.getAttribute('class') || ''}[${(el.innerText || '').replace(/\s+/g, ' ')}]`)
      return { nodes, tail: ed.innerHTML.slice(-260) }
    })
    console.log(`  ${t} → 话题节点：${st.nodes.join(' ') || '无'}`)
    console.log(`    HTML 尾：${st.tail}`)
  }
  await page.screenshot({ path: `${RUN}/${EP}-topics.png` })
  console.log(`  截图：${RUN}/${EP}-topics.png`)
} else if (verb === 'cover') {
  // 只开面板读结构，不选图、不点应用：封面是这条线最强的点击变量，但换封面会改草稿状态，
  // 先把"能不能传自定义图、要求什么比例"量下来，再决定喂哪张。
  await page.getByText('设置封面', { exact: false }).first().click({ timeout: 15_000 })
  await page.waitForTimeout(3500)
  const panel = await page.evaluate(() => {
    const txt = (s) => (s || '').replace(/\s+/g, ' ').trim()
    const files = [...document.querySelectorAll('input[type=file]')].map((el) => el.getAttribute('accept') || '(任意)')
    const buttons = []
    for (const b of document.querySelectorAll('button,[role="button"],div[class*="btn"],span[class*="btn"]')) {
      const t = txt(b.innerText)
      const r = b.getBoundingClientRect()
      if (t && t.length <= 14 && r.width && r.height && !buttons.includes(t)) buttons.push(t)
    }
    return { files, buttons, body: txt(document.body.innerText).slice(0, 700) }
  })
  console.log(`\n【cover】file inputs accept：${panel.files.join(' | ') || '无'}`)
  console.log(`  按钮：${panel.buttons.join(' | ')}`)
  console.log(`  面板文案：${panel.body}`)
  // 「设置封面」那四个字只是标题，点它什么也不开（实测点了 3.5 秒，页面纹丝不动）。
  // 真正的入口是封面缩略图本身，点进去才看得到"能不能传自定义图"。
  const opened = await page.evaluate(() => {
    const host = [...document.querySelectorAll('div,section')].find((el) => (el.innerText || '').includes('智能推荐封面'))
    const img = host?.querySelector('img,canvas,[class*="cover"]')
    if (!img) return false
    img.click()
    return true
  })
  await page.waitForTimeout(3500)
  const deep = await page.evaluate(() => {
    const txt = (s) => (s || '').replace(/\s+/g, ' ').trim()
    const files = [...document.querySelectorAll('input[type=file]')].map((el) => el.getAttribute('accept') || '(任意)')
    const words = [...new Set((document.body.innerText.match(/[^\s]{0,6}(上传封面|更换封面|本地上传|裁剪|选择封面)[^\s]{0,8}/g) || []))]
    return { files, words, body: txt(document.body.innerText).slice(0, 400) }
  })
  console.log(`  点缩略图：${opened ? '已点' : '没找到缩略图'} → file inputs accept：${deep.files.join(' | ') || '无'}`)
  console.log(`  封面相关文案：${deep.words.join(' | ') || '无'}`)
  console.log(`  当前页面前 400 字：${deep.body}`)
  await page.screenshot({ path: `${RUN}/${EP}-cover.png` })
  console.log(`  截图：${RUN}/${EP}-cover.png`)
  await page.keyboard.press('Escape').catch(() => {})
} else if (verb === 'coverset') {
  // 封面能传自定义图，但入口藏得深：先点中默认封面缩略图，才会浮出「编辑封面」，
  // 进去之后才有 accept="image/*" 的那个 file input（页面上原本只有视频那一个）。
  // 这一步只喂图、只打印裁剪界面，**不点应用**——应用会改草稿状态，看图确认后再单独放行。
  if (!existsSync(COVER)) throw new Error(`没有封面：${COVER}`)
  // 幂等：编辑器可能已经开着（前一次探到一半没关），此时那层 d-modal-mask 会挡掉缩略图的点击，
  // 再点一次就是白等 15 秒超时。判据用"有没有图片 file input"，有就直接喂图。
  const img = page.locator('input[type=file][accept*="image"]').first()
  if (!(await img.count())) {
    await page.locator('.cover-plugin-preview .default.column').first().click({ timeout: 15_000 })
    await page.getByText('编辑封面', { exact: false }).first().click({ timeout: 15_000 })
    await page.waitForTimeout(2500)
  } else {
    console.log('  封面编辑器已经开着，直接喂图')
  }
  await img.waitFor({ state: 'attached', timeout: 15_000 })
  await img.setInputFiles(COVER)
  await page.waitForTimeout(8000)
  const st = await page.evaluate(() => {
    const txt = (s) => (s || '').replace(/\s+/g, ' ').trim()
    const buttons = []
    for (const b of document.querySelectorAll('button,[role="button"],div[class*="btn"],span[class*="btn"]')) {
      const t = txt(b.innerText)
      const r = b.getBoundingClientRect()
      if (t && t.length <= 12 && r.width && r.height && !buttons.includes(t)) buttons.push(t)
    }
    return { buttons, words: [...new Set(document.body.innerText.match(/[^\s]{0,8}(裁剪|比例|3:4|4:3|1:1|清晰|应用|取消|重选)[^\s]{0,8}/g) || [])].slice(0, 16) }
  })
  console.log(`\n【coverset】喂入 ${COVER}（${(statSize(COVER) / 1e6).toFixed(2)} MB，1080×1440）`)
  console.log(`  按钮：${st.buttons.join(' | ')}`)
  console.log(`  裁剪相关文案：${st.words.join(' | ') || '无'}`)
  await page.screenshot({ path: `${RUN}/${EP}-coverset.png` })
  console.log(`  截图：${RUN}/${EP}-coverset.png（还没点应用）`)
} else if (verb === 'coverapply') {
  // coverset 只把图喂进编辑器；点「完成」才把它落成笔记封面。仍然在草稿内，不碰发布。
  await page.getByText('完成', { exact: true }).last().click({ timeout: 15_000 })
  await page.waitForTimeout(4000)
  const st = await page.evaluate(() => ({
    modal: !!document.querySelector('.d-modal-mask'),
    thumbs: [...document.querySelectorAll('.cover-plugin-preview img')].map((i) => i.src.slice(0, 60)),
  }))
  console.log(`\n【coverapply】编辑器还开着：${st.modal ? '是' : '否'}；封面条：${st.thumbs.join(' | ') || '无'}`)
  await page.screenshot({ path: `${RUN}/${EP}-cover-applied.png` })
  console.log(`  截图：${RUN}/${EP}-cover-applied.png`)
} else if (verb === 'comment') {
  // 置顶评论只能在网页版发：创作者中心十项导航里没有任何评论项，数据看板只报「评论数」（实测与四条证据见 xhs-plan.md）。
  // 这一步**只填不发**——发评论是公开动作，用户口径就是"我来发"，所以「发送」那颗按钮归人点，
  // 本驱动也不给 --go：没实测过的写动作不写进代码，跟 publish 步一个道理。
  const text = ep.publish?.xiaohongshu?.pinned
  if (!text) throw new Error(`${EP} 没有 publish.xiaohongshu.pinned——不替这一集猜置顶评论`)
  const errs = []
  if (/https?:\/\//.test(text)) errs.push('置顶评论里有站外链接')
  if (/github/i.test(text)) errs.push('置顶评论里有 GitHub 字样')
  if (errs.length) {
    console.log('停在发评论前：')
    for (const e of errs) console.log(`  - ${e}`)
    process.exit(2)
  }
  const wp = await ctx.newPage()
  wp.setDefaultTimeout(60_000)
  // 笔记地址每次现取：/explore/<id> 少了 xsec_token 直接落 300031「当前笔记暂时无法浏览」，
  // 而 token 挂在主页那批 <a> 上、会跟着会话过期——抄进台账就是埋雷。
  await wp.goto('https://www.xiaohongshu.com/explore', { waitUntil: 'domcontentloaded' })
  await wp.waitForTimeout(8000)
  const prof = await wp.evaluate(() => {
    const a = document.querySelector('a[href^="/user/profile/"]')
    return a ? new URL(a.getAttribute('href'), location.href).href : null
  })
  if (!prof) throw new Error('网页版没登录：顶栏里没有 <a href="/user/profile/...">。先在这个窗口里登录网页版小红书再跑')
  await wp.goto(prof, { waitUntil: 'domcontentloaded' })
  await wp.waitForTimeout(9000)
  const xsTitle = ep.publish?.xiaohongshu?.title || ''
  const note = await wp.evaluate((t) => {
    const txt = (s) => (s || '').replace(/\s+/g, ' ').trim()
    for (const a of document.querySelectorAll('a[href*="xsec_token"]')) {
      if (t && txt(a.innerText).includes(t)) return a.href
    }
    return null
  }, xsTitle)
  if (!note) throw new Error(`主页上没找到标题含「${xsTitle}」的卡片——先回笔记管理核这条到底发出去了没，别猜`)
  await wp.goto(note, { waitUntil: 'domcontentloaded' })
  await wp.waitForTimeout(9000)
  const box = wp.locator('p.content-input').first()
  await box.waitFor({ state: 'attached', timeout: 20_000 })
  // 「评论」那条占位（.inner-when-not-active）与 p.content-input 是同一个 rect 的兄弟，占位盖在上面；
  // 直接点 p 会被它拦下（实测 TimeoutError: intercepts pointer events）。先点占位换到输入态。
  const ph = wp.locator('.engage-bar .inner-when-not-active').first()
  if (await ph.count()) await ph.click({ timeout: 15_000 })
  else await box.click({ timeout: 15_000 })
  await wp.waitForTimeout(1200)
  await wp.keyboard.insertText(text)
  await wp.waitForTimeout(1500)
  const back = await wp.evaluate(() => {
    const el = document.querySelector('p.content-input')
    return { typed: [...(el?.innerText || '')].length, url: location.href }
  })
  console.log(`\n【comment】笔记页：${back.url}`)
  console.log(`  稿件 ${[...text].length} 字 → 评论框里 ${back.typed} 字${back.typed === [...text].length ? '（一致）' : '（不一致，看截图）'}`)
  await wp.screenshot({ path: `${RUN}/${EP}-comment.png` })
  console.log(`  截图：${RUN}/${EP}-comment.png`)
  console.log('  只填不发：这一页留在这里，核对完由人点「发送」；发出去之后才有置顶入口，那一步还没实测')
} else if (verb === 'publish') {
  const gate = `${RUN}/I_HAVE_USER_OK=${EP}`
  if (!existsSync(gate)) {
    console.log(`停在发布前：闸门文件不存在 ${gate}`)
    console.log('这个文件只能来自对话里对这一条的点头，脚本不自己造。')
    process.exitCode = 3
  } else {
    throw new Error('发布这一步还没写进本驱动：字段上限与"外链能不能挂"尚未实测完，先别把不可逆动作自动化')
  }
} else {
  throw new Error(`未知步骤「${verb}」，认得的是 status / open / upload / measure / fill / topics / cover / coverset / coverapply / comment / publish`)
}

function statSize(p) {
  return statSync(p).size
}
// 不调 browser.close()：那是 CDP 连接上的 close，会把常驻浏览器和登录态一起带走。
// 工作标签页留着不关（选好的视频与填好的字只活在那一页），进程退出、socket 跟着死就行。
process.exit(process.exitCode || 0)
