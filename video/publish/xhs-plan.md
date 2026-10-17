# 小红书这条线（2026-10-17 起）

第一条试发：F5《信号量和互斥量》竖版成片。用户在对话里定的三件事：**只发 F5 一条试水**、
**由 AI 起有头浏览器探入口**、**正文/标题/评论一律不出现站外地址与 GitHub 字样**（站内是 github.io 域名，
属于禁止的那一类，导流只靠「全网同名：通往单片机之路」）。

## 为什么是浏览器驱动而不是 API

本机没有任何小红书开放平台凭证，创作者后台也没有可直连的发布接口被验过；
上传入口实测在 `creator.xiaohongshu.com/publish/publish?target=video`，是一个 SPA 表单。
所以沿用抖音那套：常驻有头 chromium + 持久 profile + 分步驱动 + 发布前放行标记。

- 常驻进程：`video/publish/xhs-daemon.mjs`，profile 目录 `.temp/douyin-profile`（与抖音/B站/知乎共用同一个窗口），CDP 端口 **9223**
- 探针：`video/publish/xhs-probe.mjs`（只读，导航 + 取文本 + 截图；`--click` 只点"打开编辑器"这类入口，不点任何提交按钮）
- 驱动：`video/publish/xhs-step.mjs <verb> --ep=<id>`，步骤 `status open upload measure fill topics cover coverset coverapply publish`
- 放行：`publish` 之前必须有 `.temp/xhs-run/I_HAVE_USER_OK=<ep>`，这个文件只能来自对话里对这一条的点头；
  **而且就算闸门在，`publish` 步也还是直接抛错**——发布这一步至今没写进驱动，F5 那条是人点的
- 登录态：2026-10-17 用户在常驻窗口里以手机号验证码登录，账号「本机实跑」（小红书号 4947744565）；凭证不落对话、不落仓库

## 实测事实（每条都写着怎么量出来的，别当常识抄）

| 事实 | 数值 | 怎么量的 |
|---|---|---|
| 标题上限 | **20 字**，且**输入不截断** | `measure` 步喂 39 字，`input.value` 仍是 39，页面把计数器印成「39 / 20」——超限只在提交时判 |
| 正文上限 | **1000 字**，同样不截断 | 喂 1400 字，编辑器留 1400，计数器「1400 /1000」 |
| 话题 | 必须接住弹层才是 chip | 正文直接打 `#FreeRTOS #互斥锁` 是黑字；打 `#名字` 等 2.2 秒按回车才生成 `a.tiptap-topic`，带 `data-topic` 的 id 与 `xhsdiscover://topic/v2/...` |
| 视频 | mp4/mov 等，≤4 小时、≤20GB | 上传页文案；6.53 MB 的 `douyin.mp4` 实传成功，回「检测为高清视频」 |
| 封面 | 可传自定义图 | 入口藏三层：点默认封面缩略图才浮出「编辑封面」→ 里面才有 `accept="image/png, image/jpeg, image/*"` 的 file input → 有 裁剪/模版/贴纸/文字/滤镜/标记 → 点「完成」才落定 |
| 封面质检 | 平台自己会评级 | 应用后页面绿勾那句「封面效果评估通过，未发现封面质量问题」 |
| 合集 | 有，对应抖音/B站的合集 | 「加入合集 · 创建合集」在内容设置区，**本次未创建**（要起名，属人工决定） |
| 可见性 | 公开可见 / 定时发布 | 更多设置区 |
| 声明 | 原创声明 + 添加内容类型声明 | 内容设置区；**本次未选**，与抖音那条「自主声明必填」不是同一件事，别照抄 |

护栏因此写在本机这一侧：`fill` 步在填之前就断 标题 ≤20、正文 ≤1000（按码点）、
标题/正文/评论里出现 `http(s)://` 或 `github` 直接退出码 2。平台不替我们拦。

## 与抖音那条线的四处口径差

1. **导流**：抖音是「描述不提、全进置顶评论」；小红书按用户口径**整条线都不出现地址**，
   连置顶评论也只写复现命令与「全网同名」。竖版封面图底部那句「寄存器级 · 站内有全篇」
   是产线 `package.mjs:161` 给的图内文案，不是链接——要不要为小红书单独出一版去掉它的封面，是另一个决定。
2. **标题**：抖音作品标题框实测 30 字且静默截尾；小红书 20 字且**不截断、只标红**，
   所以 F5 用的是抖音那三条候选标题里最短的一条「xSemaphore 一个函数都没有」（18 字）。
3. **话题**：抖音在描述里打 `#` 就成话题；小红书必须回车接弹层，纯文本的 `#` 不算。
4. **合集**：抖音合集名沿用 `douyin-release.mjs` 的常量；小红书侧本次没建，第一条发出去再定。

## F5 这条：已发布（2026-10-17 15:32）

`video/episodes/f5-sem-mutex/episode.json` 的 `publish.xiaohongshu` 是文案事实源：
title 18 字 / body 475 字（去空白，页面计数 539）/ topics 三个 / pinned / repro / noLink 说明。
草稿在 15:2x 齐了（视频已传、标题正文已填、三个话题成 chip、自定义封面应用且过平台质检），
**15:32 由人在常驻窗口点「发布」发出去**——`xhs-step.mjs publish` 到现在也只是查闸门然后抛错，发布动作没自动化，
第一条就是人点的。留痕在 `.temp/xhs-run/f5-sem-mutex-published.txt`。

发布成功的判据（本轮实测，别再猜）：
- **笔记管理 `/new/note-manager` 的「已发布」标签里有这条**（「审核中」「未通过」都是「没有找到相关笔记」）——这是唯一权威信号。
- 发布后表单 URL 变成 `/publish/publish?source=&published=true`，草稿箱归零。**URL 是"发过了"的事后信号，不是"点到了"**：
  别拿它当成功判据去写自动化，还是要回笔记管理看。
- 观众侧详情页从笔记管理点标题打不开（只会选中，弹出的新标签不导航），本轮没能从公网侧回读；
  发布前 1 分钟对编辑器正文做过逐字比对，`http(s)://` 与 `github` 两个正则双双「无」。

这条线上还欠着的：内容类型声明与原创声明（都没选，属人工决定）、合集挂载的最后一下提交（见下面两节）。
置顶导流评论这条已经打通并且真发出去了，见下一节。

取证截图：`f5-sem-mutex-filled.png`（填写后）、`f5-sem-mutex-topics.png`（话题成 chip）、
`f5-sem-mutex-coverset.png`（封面编辑器喂图）、`f5-sem-mutex-cover-applied.png`（封面落定 + 绿勾）、
`manager-已发布.png` / `manager-审核中.png` / `manager-未通过.png`（发布状态三查）。

## 置顶评论这条线（2026-10-17 打通到「只填不发」）

用户口径是「先写工具，我来发」。工具写成 `xhs-step.mjs comment`，**默认只把字填进评论框、「发送」归人点**；
后来用户明确点头「发送这条置顶评论」，才给它加了 `--go` 分支——闸门是**另一个文件名**
`I_HAVE_USER_OK_COMMENT=<ep>`，不复用 `I_HAVE_USER_OK=<ep>`：那个是"这一集可以发布"的授权，混用等于以后谁看见它在就以为发评论也批过了。

先记下为什么创作者中心不行（四条实测证据，别再从头探一遍）：

| 探到的事实 | 怎么量的 |
|---|---|
| 创作者中心**没有评论区，也没有评论管理** | 笔记管理左侧导航全文只有：首页 / 笔记管理 / Builder hub / 小工具 / Red Skill / 数据看板 / 活动中心 / 笔记灵感 / 创作学院 / 创作百科。数据看板的 `/statistics/note-detail?noteId=...` 只报「评论数 0」，没有任何管理评论的按钮 |
| 笔记那一行的图标按钮是：置顶 / 查看数据 / 编辑（+两个无 tooltip 的） | 逐个 `hover()` 读 tooltip（`.temp/xhs-comment-probe3.mjs`，全程不点——其中「编辑」会改已发布笔记，可能重新进审核，那是要人点头的动作）。**那个「置顶」置顶的是笔记本身，不是评论**，别拿它当置顶评论用 |
| 未登录网页版时公网笔记页直连被拒 | `https://www.xiaohongshu.com/explore/<noteId>` 落到 `/404?...error_code=300031&error_msg=当前笔记暂时无法浏览`——要看笔记必须带 `xsec_token`，而笔记管理页面上**没有任何指向 www 域的 `<a>`**（扫过，0 条） |
| 创作者中心的登录态不等于网页版登录态 | 同一个 profile，创作者中心是登录的，`www` 域一开始挂着「登录」按钮。用户在窗口里补登网页版之后，顶栏出现 `<a href="/user/profile/5ffd8d4b0000000001000162">我</a>`，这条路才通 |

通链路的走法（`comment` 步就是照这个写的，全程不拼 URL）：
`/explore` 顶栏那个 `a[href^="/user/profile/"]` → 主页上按标题匹配到 `a[href*="xsec_token"]` → 跟到 `/explore/<noteId>?xsec_token=...&xsec_source=pc_user`。
**token 每次现取**，抄进台账会跟着会话过期成雷。noteId 是 `6ad324850000000018004361`（点笔记管理里那条的封面，新标签落到 `/statistics/note-detail?noteId=...` 抄来的）。

评论区自己的结构也有一个坑：`div.content-edit` 里 `p.content-input`（`contenteditable="true"`）和
`div.not-active.inner-when-not-active`（文案就是「评论」）是**同一个 rect 的兄弟**，占位盖在上面；
直接 `click()` 那个 `p` 会 `TimeoutError: ... intercepts pointer events`。先点占位才换到输入态。

实跑验证（发出去的那一次）：`node video/publish/xhs-step.mjs comment --ep=f5-sem-mutex --go`
→ 稿件 138 字、评论框回填 138 字一致；点「发送」后**评论框剩 0 字**（清空即发出去了），列表里按前 18 字找回这条：是。
截图 `f5-sem-mutex-comment.png`（填好待发）、`f5-sem-mutex-comment-sent.png`（发完）。

## 置顶这件事在网页版做不了（2026-10-17 量完，据此**不写** `pin` 步）

评论真发出去之后按用户要求补量了置顶入口，结论是否定的，四条证据：

| 探到的事实 | 怎么量的 |
|---|---|
| 网页版自家评论上「…」菜单**只有「删除评论」**，没有置顶 | `.temp/xhs-pin-probe4.mjs` 点开自己那条评论的菜单，截图 `.temp/xhs-run/comment-menu-open.png` |
| 整页扫不到「置顶」字样 | 同一次跑里对 `document.body.innerText` 正则匹配「置顶」→ 无 |
| 创作者中心那条路也没有 | 上一节四条证据：导航里没评论项，笔记行的「置顶」置顶的是**笔记**不是评论 |
| 数据看板只报「评论数」 | `/statistics/note-detail?noteId=...` 上没有任何评论管理按钮 |

所以小红书这条线的口径与抖音一致：**置顶评论只能在 App 里长按做**，`xhs-step.mjs` 里不写 `pin` 步。
没实测过的写动作不写进代码——这条就是那个规矩的一次兑现：探完发现入口不存在，那就停，不拿"大概是这样"编一个 `pin` 出来。

## 合集：已建好，挂载差最后一下提交（2026-10-17 改口径）

上午定的「这轮先不建」被用户改掉了：合集「STM32 零基础自学」已由人在网页端建好，现在授权把 F5 挂上去。
合集名进事实源 `publish.xiaohongshu.collection`，脚本里不写字面量。

挂载链路（`xhs-step.mjs collection` 就是照这个写的，全程不拼 URL、noteId 不抄进代码）：

1. 笔记管理里按标题找到那张 `.note-card__body`，逐个 `hover()` 它的 `[class*="action-btn"]`，
   认 tooltip 逐字等于「编辑」的那颗（按下标猜会在别的集上点错）。
2. 点它 → **新标签**落到 `/publish/update?id=<noteId>&noteType=video`，表单回填标题/正文/话题（话题 chip 还在，538/1000）。
3. 点 `.collection-plugin-button`（文案「选择合集」）→ 弹层 `.d-popover` 里可选项是 `div.item`，
   逐字文本 `STM32 零基础自学`（**中间一个半角空格**），footer 是「创建合集」。按整段文本全等认领，别按子串——子串会把含 footer 的容器也捞进来。
4. 点中之后：那一行末尾的「选择合集」换成合集名，而 `.collection-plugin-button` 这个类**消失**。
   所以判据只能读 `.collection-plugin-wrapper` 整行文本，不能盯按钮在不在。

两个关键实测结论：

- **选中只活在表单里**。关掉编辑页重开，那行又回落到「选择合集」（本轮冷跑两次都是这个结果）——不提交就不算挂上。
- 提交那颗按钮是 `<xhs-publish-btn is-publish=true is-save-draft=false submit-text=发布 save-text=暂存离开 submit-disabled=false submit-loading=false>`，
  rect `220,740 680x90`，**closed shadow root**：全页 `getByText('发布', {exact:true})` 命中 0，
  从 x=240 到 880 每隔 40px 做 `elementFromPoint` 全部命中宿主自身（覆盖不出左右两半，坐标点也点不准）。
  实例上挂着 `_onPublish` / `_onSave` 两个函数——那是绕过前端校验直接触发提交，不做。
  顺带一个撞名坑：左上角导航里 `div.publish-video > .btn-wrapper` 文案是「发布笔记」，按"含发布的按钮"去点会点到它。

所以 `collection` 步做到"选中 + 回读 + 截图"就停手，最后那一下红色「发布」归人点（`is-publish=true` 时点下去等于把这条公开笔记重新提交，大概率再走一次审核）。
人点完之后要补的实测：重开编辑页那行应显示合集名（或去合集页看到这条视频），那才算挂上。

## 踩过的两个坑（写下来免得重来）

- 探针/驱动**绝不能关常驻页**：第一版探针 `find(p => p.url().includes('xiaohongshu'))` 拿到的正是
  daemon 唯一那一页，收尾 `page.close()` 把常驻页关掉，node 因 unsettled top-level await 以 13 退出、
  窗口消失，登录白扫。现在：驱动自己开新页、工作页永不 close、daemon 用 `setInterval` 挂进程。
- 别用全页正则读计数器：正文里那句「（6000 / 2500）」被 `/\d+\s*\/\s*\d+/` 当成计数器读进日志，
  读数看着对其实是稿件自己的字。已把稿件改成「6000 与 2500」，`fill` 的回填核对也换成**只认"整个元素的文本就是一串 a / b"**
  的那种节点（`xhs-step.mjs` 里遍历 `*` 配 `/^[\d,]+\s*\/\s*[\d,]+$/`）。
  判别力是这么验的：合成一页「正文含（6000 / 2500）+ 两个真计数器」，旧读法吐出三条、新读法只吐 `539 /1000` 与 `18 /20`
  （`.temp/xhs-counter-check.mjs`）。另一条顺带量到的事实：**没传视频时空表单上一个计数器都没有**，读到 `[]` 不代表填坏了。
