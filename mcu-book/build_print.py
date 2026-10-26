"""印前 PDF 构建器：把整书 HTML 重排成 16 开（185×260 mm）的印刷版。


与 `build_html.py` 的分工：那个负责**内容装配**（章节、罗盘、测验、附录、目录、单文件 HTML）；
这个负责**版式**（开本、版心、字体、分页、页眉页脚、目录页码）。内容一律复用前者的产物，
所以"工艺改、内容不改"是结构上成立的，不需要另一套正文处理。

分页用 paged.js（钉在 devDependencies）跑在已经装好的 Chromium 里：
  · `@page` 的尺寸/版心/页眉页脚由 `print/book-print.css` 声明；
  · 目录页码由 `target-counter(attr(href), page)` 解析成真实页码；
  · 打印时把 Chromium 的页面盒子设成与开本一致、边距归零 —— paged.js 已经把内容
    切成"每页一个盒子"，Chromium 再套一层页边距就会双重缩排、页数也会变。

用法：
  python mcu-book/build_print.py --out-dir mcu-book/dist            # 全量
  python mcu-book/build_print.py --sample 2 --out-dir .temp/print    # 原型：前 2 章
  python mcu-book/build_print.py --bleed 3 --out-dir mcu-book/dist   # 胶印出血版
"""

from __future__ import annotations

import argparse
import base64
import collections
import re
import shutil
import sys
import tempfile
import time
from pathlib import Path

# Windows 控制台默认 GBK：模块导入即切 UTF-8，避免子进程/提前打印把 ✓ 炸成
# UnicodeEncodeError（三次踩坑后钉死在导入期）。StringIO 场景无 reconfigure，跳过。
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

BOOK_DIR = Path(__file__).resolve().parent
REPO_ROOT = BOOK_DIR.parent
sys.path.insert(0, str(BOOK_DIR))

import build_html  # noqa: E402  —— 与 build_html.py 自身的调用约定一致（脚本方式运行）

PRINT_DIR = BOOK_DIR / "print"
PRINT_CSS = PRINT_DIR / "book-print.css"
FONTS_DIR = PRINT_DIR / "fonts"
PAGED_LIB = REPO_ROOT / "node_modules" / "pagedjs" / "dist" / "paged.js"

TRIM_MM = (185.0, 260.0)
CHAPTER_RE = re.compile(r'<article class="chapter".*?</article>', re.S)


def slice_sample(html: str, chapters: int) -> str:
    """原型模式：只留前 N 章（封面/前言/目录保留，目录页码才有东西可解析）。"""
    matches = list(CHAPTER_RE.finditer(html))
    if len(matches) < chapters:
        raise SystemExit(f"HTML 里只有 {len(matches)} 章，取不到 {chapters} 章")
    keep_end = matches[chapters - 1].end()
    tail = html.rfind("</main>")
    return html[:keep_end] + html[tail:]


VARIATION_SELECTOR = "\ufe0f"
BOOK_TITLE_MARKER = "__BOOK_TITLE__"


def strip_variation_selectors(html: str) -> tuple[str, int]:
    """去掉 U+FE0F（变体选择符）。

    实测（最小用例可复现）：`💡` 走我们随书分发的单色 Noto Emoji，而 `💡️`（emoji + VS16）
    会让 Chromium 改用系统彩色 emoji 字体，印出来是**无名 Type3 位图**——既不能检索，
    在没装该 emoji 字体的机器上还会变成方块。纸面是单色印刷，VS16 没有任何意义。
    """
    return html.replace(VARIATION_SELECTOR, ""), html.count(VARIATION_SELECTOR)


TABLE_SCROLL_STYLE = re.compile(r'(<div class="table-scroll"[^>]*?) style="--table-columns: \d+"')


def strip_table_scroll_inline_vars(html: str) -> tuple[str, int]:
    """剥掉 .table-scroll 上的 `--table-columns` 内联样式。

    这个 CSS 变量只有屏幕版的 `min-width: max(100%, calc(var(--table-columns) * 8rem))`
    用；印刷版表格一律 `width: 100%`，变量是死值。但它必须剥：paged.js 的
    DisplayHandler 把**任何带内联 style 且没显式 display 的元素**标成
    `data-undisplayed`（实测全书 427 个 table-scroll 全部中标），于是
    `displayedElementAfter/Before` 一律跳过这些表格——`h2 { break-after: avoid }`
    的"下一个元素"标记落空，跟在表格前的标题会被孤伶伶留在页底
    （实测 p10「怎么读这一章」整页只有标题，表格翻到下一页）。
    """
    stripped, count = TABLE_SCROLL_STYLE.subn(r"\1", html)
    return stripped, count


def inline_svg_images(html: str) -> tuple[str, int]:
    """把 data-URI 的 SVG `<img>` 改成内联 `<svg>`。

    为什么：图是 `<img src="data:image/svg+xml;base64,…">` 时，SVG 是独立文档，
    印刷样式里的 `svg text { font-family: … }` 进不去，图内文字全部落到系统字体
    （Segoe UI / 微软雅黑 / Consolas…）——同一本书两台机器排出来不是同一本，
    CI 上没有这些字体时还会走样；且这些系统字体的子集被嵌进 PDF，不可检索。
    实测（同一张图，两份 1 页 PDF）：img 版嵌入 7 支系统字体；内联版只剩随书字体，
    中文标签保留。前提已核验：全部 103 张图无 `<style>`/`class`（不引入全局样式冲突），
    注释里合法含 `--` 的图在 DOM 化时交给浏览器解析（XML 严格模式会拒收，HTML 不拒）。

    SMIL：`pauseAnimations()` 对内联 SVG 一样有效（分页与打印发生在分页引擎切片之后，
    首帧口径不变）；`document.fonts.ready` 先于分页（build_print 主流程顺序不变）。
    """
    pattern = re.compile(
        r'<img\b(?P<pre>[^>]*?)\bsrc="data:image/svg\+xml;base64,(?P<svg>[^"]+)"(?P<post>[^>]*)>'
    )
    count = 0

    def replace(match: re.Match[str]) -> str:
        nonlocal count
        svg = base64.b64decode(match.group("svg")).decode("utf-8")
        svg = re.sub(r"^<\?xml[^>]*\?>\s*", "", svg)
        # 印刷剥掉文本描边光晕（paint-order="stroke"）：带 stroke 的文字在
        # Chromium 打印管线里会变成无名 Type3 轮廓位图（不可检索、在低分辨率
        # 打印机上发虚）。实测最小复现：带 paint-order 的一行 hex 文本必出
        # 一个 Type3；去掉后回到 Type0 TrueType。全书仅 stack-frame.svg 用此
        # 技法。**只删携带 paint-order 的那个 <g>/<text> 标签上的 stroke 三件套**——
        # 整个 SVG 盲删会把 fill="none" 的虚线栈槽也抹掉（评审抓到的回归）。
        if 'paint-order="stroke"' in svg:
            def strip_halo(m: re.Match[str]) -> str:
                tag = m.group(0)
                tag = re.sub(r'\s*paint-order="stroke"', "", tag)
                tag = re.sub(r'\s*stroke-width="[^"]*"', "", tag)
                tag = re.sub(r'\s*stroke-linejoin="[^"]*"', "", tag)
                tag = re.sub(r'\s*stroke="[^"]*"', "", tag)
                return tag
            svg = re.sub(r'<(?:g|text|tspan)[^>]*paint-order="stroke"[^>]*>', strip_halo, svg)
        # id 作用域化：103 张图各自定义 id="arr" 这类箭头/渐变/裁剪引用，
        # 内联进同一文档后 url(#arr) 只解析到第一个定义——后续图的箭头会拿到
        # 错色/错尺寸（实测 id=arr 有 12 个互不相同的 marker 定义，fill #666 /
        # #94a3b8 / #3eaf7c、markerWidth 7 vs 8）。字体门抓不到这种错。
        # 每张图内联时给 id 与引用统一加前缀。
        prefix = f"svg{count}-"
        local_ids = set(re.findall(r'\bid="([^"]+)"', svg))
        for local_id in local_ids:
            svg = re.sub(rf'\bid="{re.escape(local_id)}"', f'id="{prefix}{local_id}"', svg)
        for local_id in local_ids:
            escaped = re.escape(local_id)
            svg = re.sub(rf"url\(#{escaped}\)", f"url(#{prefix}{local_id})", svg)
            svg = re.sub(rf'xlink:href="#{escaped}"', f'xlink:href="#{prefix}{local_id}"', svg)
            svg = re.sub(rf'\bhref="#{escaped}"', f'href="#{prefix}{local_id}"', svg)
        pre, post = match.group("pre"), match.group("post")
        attrs = pre + post
        # 图注等其余属性（class/alt…）保留在原位；class 迁到内联 svg 上
        cls = ""
        cls_match = re.search(r'\sclass="([^"]*)"', attrs)
        if cls_match:
            cls = f' class="{cls_match.group(1)}"'
        svg = re.sub(r"<svg\b", f"<svg{cls}", svg, count=1)
        count += 1
        return svg

    html = pattern.sub(replace, html)
    return html, count


def prepare_site(out_dir: Path, html: str, bleed_mm: float, fonts_dir: Path, book_title: str) -> Path:
    """把印刷用 HTML、样式与字体放到同一目录（相对引用，浏览器才能读到字体）。"""
    site = out_dir / "print"
    site.mkdir(parents=True, exist_ok=True)
    fonts_out = site / "fonts"
    if not fonts_dir.is_dir():
        raise SystemExit(
            f"缺少字体子集：{fonts_dir}\n先跑 mcu-book/subset_fonts.py（见该脚本 docstring 的用法）"
        )
    shutil.copytree(fonts_dir, fonts_out, dirs_exist_ok=True)

    css = PRINT_CSS.read_text(encoding="utf-8")
    # 偶数页页眉的书名：占位符必须在这里替换（占位符在 CSS 里，不在 HTML 里）
    css = css.replace(BOOK_TITLE_MARKER, book_title.replace('"', "'"))
    if bleed_mm:
        width, height = TRIM_MM[0] + bleed_mm * 2, TRIM_MM[1] + bleed_mm * 2
        # 出血版：页面扩到裁切尺寸 + 2b，版心各边距同步 +b（正文相对裁切线
        # 位置不变）。每处替换都必须命中——命中不了说明 CSS 改了这里没跟上，
        # 宁可当场报错也不许静默产出错误的出血版（实测 margin 字符串漂移后
        # 封面四角露白边也没人发现）。
        b = bleed_mm
        replacements = [
            (
                f"size: {TRIM_MM[0]:.0f}mm {TRIM_MM[1]:.0f}mm;",
                f"size: {width:.0f}mm {height:.0f}mm;\n  bleed: {b:.0f}mm;\n  marks: crop;",
            ),
            ("margin: 20mm 23mm 22mm 24mm;", f"margin: {20+b:.0f}mm {23+b:.0f}mm {22+b:.0f}mm {24+b:.0f}mm;"),
            ("margin-left: 23mm;", f"margin-left: {23+b:.0f}mm;"),
            ("margin-right: 24mm;", f"margin-right: {24+b:.0f}mm;"),
            ("margin-left: 24mm;", f"margin-left: {24+b:.0f}mm;"),
            ("margin-right: 23mm;", f"margin-right: {23+b:.0f}mm;"),
        ]
        for old, new in replacements:
            if old not in css:
                raise SystemExit(f"出血版式替换未命中（CSS 已漂移，先同步这里）: {old}")
            css = css.replace(old, new, 1)

    # 印刷样式必须排在书稿自带样式之后，才能覆盖屏幕版的栏宽与字号
    html = html.replace("</head>", f"<style>{css}</style>\n</head>", 1)
    page = site / "mcu-deep-book-print.html"
    page.write_text(html, encoding="utf-8")
    return page


def render_pdf(page_path: Path, pdf_path: Path, bleed_mm: float, browser_override: str | None,
               collect_terms: list[str] | None = None) -> dict:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:  # pragma: no cover - 环境缺依赖时的明确报错
        raise SystemExit("需要 Playwright：python -m pip install -r mcu-book/requirements.txt") from exc

    width = TRIM_MM[0] + bleed_mm * 2
    height = TRIM_MM[1] + bleed_mm * 2
    stats: dict = {}
    # 与 build_html.py 同一套浏览器探测：CI 上用 Playwright 自带 Chromium，
    # 本机（Playwright 只装了 headless shell 时会缺）用系统 Edge/Chrome。
    candidates = build_html._browser_candidates(browser_override)  # noqa: SLF001
    executable = next((p for p in candidates if p.is_file()), None)
    if browser_override and executable is None:
        raise SystemExit(f"指定的浏览器不存在: {browser_override}")
    with sync_playwright() as playwright:
        launch: dict = {"headless": True}
        if executable is not None:
            launch["executable_path"] = str(executable)
        browser = playwright.chromium.launch(**launch)
        try:
            page = browser.new_page(viewport={"width": 900, "height": 1200})
            page.emulate_media(media="print", color_scheme="light")
            page.goto(page_path.resolve().as_uri(), wait_until="load")
            page.evaluate("document.fonts ? document.fonts.ready : Promise.resolve()")
            # 折叠块（大量「参考答案」）必须展开后再分页，否则印出来整段失踪
            page.evaluate("document.querySelectorAll('details').forEach(d => d.open = true)")
            # SMIL 动画统一回到第 0 帧并暂停：屏幕版是"离屏暂停、回视口续播"，
            # 印刷没有视口概念——任其跑的话打印快照取到的是随机时刻的帧，且实测
            # 分页引擎切片 SVG 时 SMIL 处于活动状态会产生重影字形（同一文本
            # Type3/Type0 双份，p87 的 0x2000FFF0）。归零后与"静态首帧"口径一致。
            page.evaluate(
                "document.querySelectorAll('svg').forEach(s => {"
                "  if (typeof s.setCurrentTime === 'function') s.setCurrentTime(0);"
                "  if (typeof s.pauseAnimations === 'function') s.pauseAnimations();"
                "})"
            )
            page.add_script_tag(path=str(PAGED_LIB))
            started = time.time()
            pages = page.evaluate(
                """async () => {
                    const previewer = new window.Paged.Previewer();
                    const flow = await previewer.preview();
                    return flow.total;
                }"""
            )
            stats["pagedSeconds"] = round(time.time() - started, 1)
            stats["pagedPages"] = pages
            if collect_terms:
                import json as _json
                # 组合词按别名匹配："ABI / 调用约定" 正文里只写单边；
                # "MMIO（内存映射外设）" 正文只写 MMIO（剥掉括号注）。
                # 纯 ASCII 短别名（AF/UB）用词边界正则，防 "AF" 误中 "AFIO"。
                alias_map = {}
                for t in collect_terms:
                    aliases = []
                    for piece in re.split(r"\s*/\s*|\s+vs\.?\s+", t):
                        piece = re.sub(r"（[^）]*）", "", piece).strip()
                        if piece:
                            aliases.append(piece)
                    alias_map[t] = aliases or [t]
                terms_js = _json.dumps(alias_map, ensure_ascii=False)
                term_pages = page.evaluate(
                    f"""() => {{
  const pages = document.querySelectorAll('.pagedjs_page');
  const index = {{}};
  const aliasMap = {terms_js};
  for (const t of Object.keys(aliasMap)) index[t] = [];
  pages.forEach((pg, i) => {{
    // 结构性页面不算"出现"：封面/版权/导读/目录/书尾页，以及术语表
    // （附录 D）与索引（附录 H）自身——否则每个词都先指向附录/目录
    // 而不是正文（实测 ABI 首次命中 1080 = 附录 D 续页；IDF 命中目录）。
    // paged.js 克隆时分页盒保留祖先链，id 转为 data-id。
    if (pg.querySelector('.cover,.copyright,.contents,.part-divider,[data-id="how-to-read"],'
      + '[data-id="colophon"],[data-id="appendix-glossary"],[data-id="appendix-index"]')) return;
    const text = pg.textContent || '';
    for (const t of Object.keys(aliasMap)) {{
      const hit = aliasMap[t].some(a => {{
        if (/^[\x20-\x7e]+$/.test(a)) {{
          return new RegExp('\\\\b' + a.replace(/[.*+?^${{}}()|[\\]\\\\]/g, '\\\\$&') + '\\\\b').test(text);
        }}
        return text.includes(a);
      }});
      if (hit) index[t].push(i + 1);
    }}
  }});
  // 章节/附录起始页映射：供目录与索引换算 folio（正文从 1 起）
  const starts = {{}};
  pages.forEach((pg, i) => {{
    pg.querySelectorAll('[data-id]').forEach(el => {{
      const id = el.dataset.id;
      if (/^(ch\\d+|appendix-)/.test(id) && !(id in starts)) starts[id] = i + 1;
    }});
  }});
  // 每页实际 folio：分部隔页等不占页码，固定偏移会错章（实测目录
  // 第 13 章 154 vs 物理-9=155）。按增量逐页累进，与引擎 target-counter 同源。
  const folios = {{}};
  let folio = 0;
  pages.forEach((pg, i) => {{
    const inc = getComputedStyle(pg).getPropertyValue('--pagedjs-page-counter-increment').trim();
    if (inc !== '0' && inc !== 'none') {{ folio++; folios[i + 1] = folio; }} else {{ folios[i + 1] = null; }}
  }});
  return {{ index, starts, folios }};
}}"""
                )
                stats["termPages"] = term_pages["index"]
                stats["chapterStarts"] = term_pages["starts"]
                stats["pageFolios"] = term_pages["folios"]
            # 大纲书签：paged.js 把文档重排成页盒子，Chromium 的 page.pdf()
            # 不再产出任何标题树（实测 get_toc() 为 0 条），所以书签只能在
            # 这里从分页后的 DOM 采集：遍历页盒子，记下每个 h1/h2 出现在
            # 哪一物理页。层级在 Python 侧按"部→章→节"整形。
            outline_rows = page.evaluate(
                """() => {
  const rows = [];
  // 容器选择器必须精确：附录是 <article class="appendix">（不是 section），
  // 而 <article class="source-card"> 也是 article —— 用 closest('article')
  // 会把来源卡片当成章。
  const OWNER = 'article.chapter, article.appendix, section.part-divider, section.frontmatter, section.contents';
  // 来源卡片嵌在附录 E 里面，closest(OWNER) 会越过卡片命中 article.appendix，
  // 于是 57 张来源卡的标题（"a1 RM0090 — …"）全都成了附录的 level-2 书签。
  // 卡片标题不是书的结构，命中就整条丢掉。
  const SKIP = 'article.source-card, figure';
  document.querySelectorAll('.pagedjs_page').forEach((pg, i) => {
    pg.querySelectorAll('h1, h2').forEach(el => {
      // 书内目录页的条目是 <a>，不是标题；分部隔页的 .part-label 也不是标题。
      const text = (el.textContent || '').replace(/\\s+/g, ' ').trim();
      if (!text) return;
      if (el.closest(SKIP)) return;
      const owner = el.closest(OWNER);
      if (!owner) return;
      rows.push({
        page: i + 1,
        tag: el.tagName,
        text,
        kind: owner.tagName.toLowerCase() + '.' + (owner.className.split(/\\s+/)[0] || ''),
      });
    });
  });
  return rows;
}"""
            )
            stats["outlineRows"] = outline_rows
            # 分母 = 正文页数（不计封面/前置页/分部隔页）：这些页面的
            # --pagedjs-page-counter-increment 已被样式归零（见 print CSS），
            # counter(page) 由引擎自然从 1 起。counter(pages) 实测不随
            # --pagedjs-page-count 变化（设 999 也不变），所以分母在分页后
            # 用一条 ::after 样式字面覆写；分子仍走 counter(page)。
            page.evaluate(
                """() => {
  let total = 0;
  document.querySelectorAll('.pagedjs_page').forEach(pg => {
    const inc = getComputedStyle(pg).getPropertyValue('--pagedjs-page-counter-increment').trim();
    if (inc !== '0' && inc !== 'none') total += 1;
  });
  const style = document.createElement('style');
  style.textContent = '.pagedjs_page:not(.pagedjs_cover_page):not(.pagedjs_frontmatter_page) .pagedjs_margin-bottom-center .pagedjs_margin-content::after { content: counter(page) " / " "' + total + '" !important; }';
  document.head.appendChild(style);
}"""
            )
            pdf_path.parent.mkdir(parents=True, exist_ok=True)
            page.pdf(
                path=str(pdf_path),
                width=f"{width}mm",
                height=f"{height}mm",
                margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
                print_background=True,
            )
        finally:
            browser.close()
    return stats


# 栏目名判定阈值：同一个 h2 标题在全书重复出现 >= 这么多次，就是章节模板
# 的栏目名（本章罗盘、学习目标、先跑起来、对照表……），不是"这一章讲了
# 什么"。手写名单维护不住 —— 实测写了 14 个名字仍漏掉 16 个（"先跑起来"
# 68×、"附录：工程完整源码" 39×、"对照表：本章概念 → 仓库落点" 28× 等，
# 共约 280 条照样进了书签面板）。改成按出现频次判，新增栏目自动覆盖。
# 标定：>=5 删 1167 条留 598；>=10 只删 1072（"板卡与版本前提" 8× 这类漏网）。
# 唯一的 4× 标题是"先跑起来（10 分钟 quick win，不用开发板）"，与 68× 的
# "先跑起来（10 分钟 quick win）"同名不同括号，归一化后并入同一桶。
TEMPLATE_SECTION_MIN_REPEATS = 5


def _section_key(text: str) -> str:
    """归一化小标题：去掉编号前缀与括号补语，只留栏目名本体。

    空结果要回退：整条都是括号的标题（"（一）概览"）split 后是空串，
    若放过就会把一堆无关标题并进同一个空桶，>=5 条时集体消失。
    """
    stripped = re.sub(r"^[一二三四五六七八九十〇零\d]+[、.．]\s*", "", text.strip())
    key = re.split(r"[（(]", stripped)[0].strip()
    return key or stripped


def print_outline(rows: list[dict], manifest: dict) -> list[list]:
    """把分页后采集的 h1/h2 行整形成 部(1) → 章(2) → 节(3) 书签树。

    不复用 build_html.restructured_outline：那支函数的输入是 Chromium 自己
    生成的标题树，而 paged.js 产物里 get_toc() 是 0 条（页盒子重排之后
    Chromium 不再输出标题树），两者前提不同。
    结构条目缺失按契约失败处理：一本书少了部或章的书签，不如当场报错。
    """
    expected_parts = [part["title"] for part in manifest["parts"]]
    # 栏目名按频次识别：先统计章内 h2 的归一化标题重复多少次。
    repeats = collections.Counter(
        _section_key(row["text"]) for row in rows if row["kind"] == "article.chapter" and row["tag"] == "H2"
    )
    outline: list[list] = []
    seen_parts: list[str] = []
    chapter_count = 0
    skipped_sections = 0
    for row in rows:
        text, page, kind, tag = row["text"], row["page"], row["kind"], row["tag"]
        if kind == "section.part-divider":
            if tag == "H1":
                outline.append([1, text, page])
                seen_parts.append(text)
            continue
        if kind == "article.chapter":
            if tag == "H1":
                outline.append([2, text, page])
                chapter_count += 1
            elif not outline:
                continue
            elif repeats[_section_key(text)] >= TEMPLATE_SECTION_MIN_REPEATS:
                skipped_sections += 1
            else:
                outline.append([3, text, page])
            continue
        if kind == "article.appendix":
            outline.append([1, text, page] if tag == "H1" else [2, text, page])
            continue
        if kind in {"section.frontmatter", "section.contents"} and tag == "H1":
            outline.append([1, text, page])
    missing = [title for title in expected_parts if title not in seen_parts]
    if missing:
        raise SystemExit(f"大纲：manifest 里的分部没出现在书签里：{missing}")
    chapters = len(build_html.chapter_files(manifest))
    if chapter_count != chapters:
        raise SystemExit(f"大纲：章书签 {chapter_count} 条 ≠ manifest 章数 {chapters}")
    # 层级不许越级（1→3 会让阅读器的书签树错位）
    previous = 0
    for level, title, page in outline:
        if level > previous + 1:
            raise SystemExit(f"大纲层级越级：{title!r}(level {level}) 紧跟 level {previous}，页 {page}")
        previous = level
    # 删掉多少必须印出来：这一轮返工的根源就是"删了多少"不可见 —— 名单
    # 漏掉 16 个栏目名、280 条脏书签照样进了产物，日志上看不出任何异常。
    print(f"大纲：按频次（>={TEMPLATE_SECTION_MIN_REPEATS}×）丢弃重复栏目名书签 {skipped_sections} 条")
    return outline


def finalize_pdf(pdf_path: Path, manifest: dict, rows: list[dict] | None) -> None:
    """给产物补上 PDF 元数据与大纲书签。

    Chromium 写进产物的只有 metadata.title（取自 <title>），作者/主题/
    关键词一概空白，大纲零条 —— 一本上千页的书在阅读器里没有书签面板
    是不能交付的。
    """
    try:
        import fitz
    except ImportError:
        print("（未装 PyMuPDF，跳过元数据与大纲）")
        return
    outline = print_outline(rows or [], manifest)
    document = fitz.open(pdf_path)
    try:
        document.set_toc(outline)
        document.set_metadata(
            {
                **document.metadata,
                "title": manifest["title"],
                "author": manifest.get("author", ""),
                "subject": manifest.get("subtitle", ""),
                "keywords": "单片机, STM32F407, ESP32-S3, FreeRTOS, RT-Thread, GD32, 寄存器",
                "creator": "mcu-book/build_print.py + paged.js",
            }
        )
        document.save(str(pdf_path), incremental=True, encryption=fitz.PDF_ENCRYPT_KEEP)
    finally:
        document.close()
    levels = [row[0] for row in outline]
    print(
        "元数据与大纲：title/author/subject/keywords 已写入，"
        f"大纲 {len(outline)} 条（部 {levels.count(1)} / 章 {levels.count(2)} / 节 {levels.count(3)}）"
    )


def report(pdf_path: Path, bleed_mm: float) -> int:
    try:
        import fitz
    except ImportError:
        print("（未装 PyMuPDF，跳过产物体检）")
        return 0
    document = fitz.open(pdf_path)
    mm = lambda pt: round(pt / 72 * 25.4, 1)  # noqa: E731
    first = document[0].rect
    fonts = {}
    for index in range(min(document.page_count, 6)):
        for font in document[index].get_fonts():
            fonts[font[3]] = fonts.get(font[3], 0) + 1
    expected = (TRIM_MM[0] + bleed_mm * 2, TRIM_MM[1] + bleed_mm * 2)
    actual = (mm(first.width), mm(first.height))
    ok_size = abs(actual[0] - expected[0]) <= 0.5 and abs(actual[1] - expected[1]) <= 0.5
    type3 = [k for k in fonts if "Type3" in k]
    print(f"产物: {pdf_path}")
    print(f"  尺寸: {actual[0]}×{actual[1]} mm（期望 {expected[0]:.0f}×{expected[1]:.0f}）{'✓' if ok_size else '✗'}")
    print(f"  页数: {document.page_count}")
    print(f"  字体类型: {fonts}{'✗ 存在 Type3 位图字形' if type3 else '✓ 全部为可嵌入轮廓字体'}")
    document.close()
    return 0 if ok_size and not type3 else 1


def assert_vector_art(html: str) -> None:
    """印前硬门：题图必须全是御舆纯矢量，否则拒绝排版。

    由来（2026-10-26）：另一条会话会直接把滤镜版题图写回 chapter-art，写作与
    构建并发时 HTML 里就可能夹着 feTurbulence——滤镜会把 88 枚题图全部栅格化，
    印前 PDF 多出上百张位图，而 12 门里没有任何一项因此变红（版面利用率只看
    单页密度，不看图片数量）。这里在排版前按快照断言，把「静默降质」变成硬失败。
    """
    if "feTurbulence" in html:
        raise SystemExit(
            "✗ 印前中止：HTML 里含 feTurbulence（题图被回退成滤镜版）。"
            "先跑 .temp/collect-art.py --apply 收编纯矢量题图，再重新 build_html。"
        )
    if "<filter" in html:
        raise SystemExit("✗ 印前中止：HTML 里含 <filter>，题图不是纯矢量版本。")


def main(argv: list[str] | None = None) -> int:
    # Windows 控制台默认 GBK，报告里的 ✓/✗/中文会在收尾打印时炸
    # UnicodeEncodeError；入口即切 UTF-8（对已是 UTF-8 的环境是无操作）。
    # 守卫 hasattr：redirect_stdout(StringIO) 场景 StringIO 没有 reconfigure。
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out-dir", type=Path, default=BOOK_DIR / "dist")
    parser.add_argument("--sample", type=int, default=None, help="原型模式：只排前 N 章")
    parser.add_argument("--bleed", type=float, default=0.0, help="出血毫米数（0 = 精确裁切尺寸）")
    parser.add_argument("--browser", default=None, help="Chromium 可执行文件路径（默认用 Playwright 自带）")
    parser.add_argument("--html", type=Path, default=None, help="复用既有整书 HTML，不重新装配")
    parser.add_argument("--fonts-dir", type=Path, default=FONTS_DIR, help="字体子集目录（默认 mcu-book/print/fonts）")
    parser.add_argument("--no-index", action="store_true", help="跳过术语索引生成（原型/调试用）")
    options = parser.parse_args(argv)

    out_dir = options.out_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="mcu-print-") as tmp:
        if options.html:
            html = options.html.read_text(encoding="utf-8")
        else:
            built = build_html.build_html(output_dir=Path(tmp))
            html = built.read_text(encoding="utf-8")
    if options.sample:
        html = slice_sample(html, options.sample)
    manifest = build_html.load_manifest()
    assert_vector_art(html)
    html, svg_count = inline_svg_images(html)
    if svg_count:
        print(f"印前排版：内联 {svg_count} 张 SVG 图（父文档字体进入图内文字）")
    html, removed = strip_variation_selectors(html)
    if removed:
        print(f"印前冻结：去掉 {removed} 个变体选择符（U+FE0F，否则 emoji 会走系统彩色字体并印成 Type3）")
    html, ts_stripped = strip_table_scroll_inline_vars(html)
    if ts_stripped:
        print(f"印前冻结：剥掉 {ts_stripped} 个 table-scroll 内联变量（否则 paged.js 把它们当隐藏元素，标题跟随保护落空）")

    page_path = prepare_site(out_dir, html, options.bleed, options.fonts_dir.resolve(), manifest["title"])
    pdf_path = out_dir / "mcu-deep-book-print.pdf"
    if not options.no_index and not options.sample:
        sys.path.insert(0, str(PRINT_DIR))
        import index as idx_mod  # noqa: E402
        terms = idx_mod.extract_terms()
        print(f"索引：第一遍分页收集 {len(terms)} 个术语的页码")
        stats = render_pdf(page_path, pdf_path, options.bleed, options.browser, collect_terms=terms)
        term_pages = stats.pop("termPages", {})
        page_folios = stats.pop("pageFolios", {})
        # 索引页码直接用收集器按页码增量算出的 folio（分部隔页不占号，
        # 固定偏移会越往后越偏）。folio 为 null 的页面不产落点。
        zero = [t for t, pages in term_pages.items() if not pages]
        if zero:
            print(f"索引：{len(zero)} 个术语正文零命中，不入索引：{'、'.join(zero)}")
        entries = [(t, [f for f in (page_folios.get(str(p)) for p in pages) if f][:6]) for t, pages in term_pages.items() if pages]
        index_html = idx_mod.render_index_html(entries, manifest["title"])
        # 目录/索引/页脚页码同源：前置页 --pagedjs-page-counter-increment: 0，
        # 引擎的 target-counter 与 counter(page) 都从 1 起，无需字面注入。
        toc_entry = '<li><a href="#appendix-index">附录 H 术语索引</a></li>'
        # 目录里每个分部都以 </ol></section> 收尾，索引要进最后的附录区
        tail_marker = "</ol></section>"
        tail_at = html.rfind(tail_marker)
        if tail_at == -1:
            raise SystemExit("目录里没有附录区（</ol></section> 未找到），索引入口无处可挂")
        html = html[:tail_at] + toc_entry + html[tail_at:]
        # 把索引注入到 </main> 之前
        html = html.replace("</main>", index_html + "\n</main>", 1)
        page_path = prepare_site(out_dir, html, options.bleed, options.fonts_dir.resolve(), manifest["title"])
        print(f"索引：第二遍分页（注入 {len(entries)} 条索引，页码按分页增量计算）")
        stats = render_pdf(page_path, pdf_path, options.bleed, options.browser)
    else:
        stats = render_pdf(page_path, pdf_path, options.bleed, options.browser)
    print(f"分页: {stats['pagedPages']} 页，用时 {stats['pagedSeconds']}s（paged.js）")
    # 原型模式只排前 N 章，结构条目不全，大纲整形必然报错——跳过。
    if not options.sample:
        finalize_pdf(pdf_path, manifest, stats.get("outlineRows"))
    return report(pdf_path, options.bleed)


if __name__ == "__main__":
    raise SystemExit(main())