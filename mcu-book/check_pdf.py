#!/usr/bin/env python3
"""PDF 出版契约反向校验——对 build_html.py --pdf 的产物做独立对账。

为什么需要它：build_html.py 只负责“写”PDF，没有任何环节证明写出来的
产物真的带齐元数据、大纲、页码与页眉。本脚本按 manifest 与 build_html
的纯函数（running_header_map / header_skip_pages / header_label_for_page）
逐页反查——规则单真源在 build_html.py，这里只校验、不复制规则。

用法：python mcu-book/check_pdf.py [pdf] [--manifest mcu-book/manifest.json]
默认校验 mcu-book/dist/mcu-deep-book.pdf；全部通过退出码 0，否则逐条点名退出码 1。
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

BOOK_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BOOK_DIR))  # 允许从仓库根直接 `python mcu-book/check_pdf.py`

from build_html import (  # noqa: E402
    PDF_NAME,
    chapter_files,
    header_label_for_page,
    header_skip_pages,
    load_manifest,
    running_header_map,
)

DEFAULT_PDF = BOOK_DIR / "dist" / PDF_NAME

# restructured_outline 里固定收纳的两个前置页标题（封面之后的扉页与目录）。
# 它们不是 manifest 声明的结构条目，数大纲时必须先剔除再比分部页数。
FRONT_MATTER_TITLES = {"这不是文章合集，是一本书", "目录与分部目标"}

FOOTER_PATTERN = re.compile(r"^(\d+) / (\d+)$")
# 页眉画在 y∈[16,34]、页脚基线在 height-8；正文由 @page 16mm/18mm 边距挡在外面，
# 所以 y<40 与 y>height-30 两个条带里只可能有页眉/页脚，不会混进正文。
HEADER_CLIP_DEPTH = 40.0
FOOTER_CLIP_DEPTH = 30.0
# 单项检查最多逐条点名多少页——全书 700 页级，页脚整体丢失时全列出来反而淹没问题。
MAX_REPORTED_PAGES = 10


def _page_bands(document) -> tuple[dict[int, str], dict[int, str]]:
    """逐页抽取页眉带/页脚带文本：{物理页码(1 起): 文本}。"""
    headers: dict[int, str] = {}
    footers: dict[int, str] = {}
    for index in range(document.page_count):
        page = document[index]
        width, height = page.rect.width, page.rect.height
        header = page.get_text("text", clip=(0, 0, width, HEADER_CLIP_DEPTH)).strip()
        footer = page.get_text("text", clip=(0, height - FOOTER_CLIP_DEPTH, width, height)).strip()
        headers[index + 1] = header
        footers[index + 1] = footer
    return headers, footers


def check_metadata(document, manifest: dict) -> list[str]:
    """1. 元数据 title/author/subject 与 manifest 一致。"""
    metadata = document.metadata
    expectations = {
        "title": manifest.get("title", ""),
        "author": manifest.get("author", ""),
        "subject": manifest.get("subtitle", ""),
    }
    failures = []
    for field, expected in expectations.items():
        actual = metadata.get(field) or ""
        if actual != expected:
            failures.append(f"metadata.{field} → 实际 {actual!r} vs 期望 {expected!r}")
    return failures


def check_outline_counts(toc: list, manifest: dict) -> list[str]:
    """2. 大纲条目数 == 章数 + 附录数 + 分部页数（章带 NN 编号、附录为 level 1）。"""
    chapters = [t for level, t, _page in toc if level == 2 and re.match(r"^\d{2}\s", t.strip())]
    appendices = [t for level, t, _page in toc if level == 1 and t.strip().startswith("附录")]
    part_pages = [
        t
        for level, t, _page in toc
        if level == 1 and not t.strip().startswith("附录") and t.strip() not in FRONT_MATTER_TITLES
    ]
    expectations = (
        ("章", len(chapters), len(chapter_files(manifest))),
        ("附录", len(appendices), len(manifest.get("appendices", []))),
        ("分部页", len(part_pages), len(manifest.get("parts", []))),
    )
    failures = []
    for label, actual, expected in expectations:
        if actual != expected:
            failures.append(f"大纲{label}条目 → 实际 {actual} 条 vs 期望 {expected} 条")
    return failures


def check_cover_has_no_footer(footers: dict[int, str]) -> list[str]:
    """3. 封面（第 1 页）无页脚页码。"""
    cover = footers.get(1, "")
    if re.search(r"\d+\s*/\s*\d+", cover):
        return [f"第 1 页（封面）→ 不应出现页码，实际页脚带文本 {cover!r}"]
    return []


def check_footers(document, footers: dict[int, str]) -> list[str]:
    """4. 除封面每页页脚恰为 "N / total"（N 为物理页码）。"""
    total = document.page_count - 1
    failures = []
    for page_number in range(2, document.page_count + 1):
        actual = footers.get(page_number, "")
        expected = f"{page_number} / {total}"
        if actual != expected:
            failures.append(f"第 {page_number} 页 → 页脚实际 {actual!r} vs 期望 {expected!r}")
    return failures


def check_skip_pages_have_no_header(headers: dict[int, str], skip_pages: set[int]) -> list[str]:
    """5. 结构页（前言/目录/分部隔页，即 header_skip_pages 集合）无页眉。"""
    failures = []
    for page_number in sorted(skip_pages):
        actual = headers.get(page_number, "")
        if actual:
            failures.append(f"第 {page_number} 页（结构页）→ 不应有页眉，实际 {actual!r}")
    return failures


def check_running_headers(headers: dict[int, str], marks: list, title: str, skip_pages: set[int], page_count: int) -> list[str]:
    """6. 逐页页眉与 running_header_map + header_label_for_page 的映射一致。"""
    failures = []
    for page_number in range(2, page_count + 1):
        if page_number in skip_pages:
            continue
        expected = header_label_for_page(marks, title, page_number)
        actual = headers.get(page_number, "")
        if actual != expected:
            failures.append(f"第 {page_number} 页 → 页眉实际 {actual!r} vs 期望 {expected!r}")
    return failures


def check_total_consistent(document, footers: dict[int, str]) -> list[str]:
    """7. 全书页数 > 0 且每个页脚的 total 都等于 page_count - 1。"""
    failures = []
    if document.page_count <= 0:
        return ["全书页数 → 实际 0 页 vs 期望 > 0 页"]
    expected_total = document.page_count - 1
    seen_totals = set()
    for page_number in range(2, document.page_count + 1):
        match = FOOTER_PATTERN.match(footers.get(page_number, ""))
        if match:
            seen_totals.add(int(match.group(2)))
    if seen_totals != {expected_total}:
        failures.append(
            f"页脚 total → 实际出现 {sorted(seen_totals) or '无'} vs 期望 {{{expected_total}}}"
        )
    return failures


def _report(name: str, failures: list[str], ok_detail: str) -> bool:
    if not failures:
        print(f"✓ {name}（{ok_detail}）")
        return True
    print(f"✗ {name}")
    for line in failures[:MAX_REPORTED_PAGES]:
        print(f"    {line}")
    if len(failures) > MAX_REPORTED_PAGES:
        print(f"    …另有 {len(failures) - MAX_REPORTED_PAGES} 条未列出")
    return False


def check_pdf(pdf_path: Path, manifest_path: Path) -> int:
    try:
        import fitz
    except ImportError:
        print("✗ 需要 PyMuPDF：python -m pip install PyMuPDF", file=sys.stderr)
        return 1
    if not pdf_path.is_file():
        print(f"✗ PDF 不存在：{pdf_path}（先跑 python mcu-book/build_html.py --pdf）", file=sys.stderr)
        return 1

    manifest = load_manifest(manifest_path)
    title = manifest.get("title", "")

    document = fitz.open(pdf_path)
    try:
        toc = document.get_toc()
        marks = running_header_map(toc, title)
        skip_pages = header_skip_pages(toc)
        header_band, footer_band = _page_bands(document)

        results = [
            _report(
                "元数据与 manifest 一致",
                check_metadata(document, manifest),
                "title/author/subject 逐项相等",
            ),
            _report(
                "大纲条目数与章节+附录+分部一致",
                check_outline_counts(toc, manifest),
                f"共 {len(toc)} 条大纲",
            ),
            _report(
                "封面无页脚页码",
                check_cover_has_no_footer(footer_band),
                "第 1 页页脚带无 N / total",
            ),
            _report(
                "除封面每页页脚为 N / total",
                check_footers(document, footer_band),
                f"逐页核对 {max(0, document.page_count - 1)} 页",
            ),
            _report(
                "结构页（前言/目录/分部隔页）无页眉",
                check_skip_pages_have_no_header(header_band, skip_pages),
                f"跳过集合 {len(skip_pages)} 页",
            ),
            _report(
                "逐页页眉与映射一致",
                check_running_headers(header_band, marks, title, skip_pages, document.page_count),
                f"逐页核对 {max(0, document.page_count - 1 - len(skip_pages))} 页",
            ),
            _report(
                "total 自洽",
                check_total_consistent(document, footer_band),
                f"total = {document.page_count - 1}，全书 {document.page_count} 页",
            ),
        ]
    finally:
        document.close()

    if all(results):
        print(f"check_pdf: PASS（{pdf_path}）")
        return 0
    print(f"check_pdf: FAIL（{sum(1 for ok in results if not ok)} 项未过）", file=sys.stderr)
    return 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", nargs="?", type=Path, default=DEFAULT_PDF, help="待校验的 PDF")
    parser.add_argument("--manifest", type=Path, default=BOOK_DIR / "manifest.json", help="manifest.json 路径")
    options = parser.parse_args(argv)
    return check_pdf(options.pdf, options.manifest)


if __name__ == "__main__":
    raise SystemExit(main())
