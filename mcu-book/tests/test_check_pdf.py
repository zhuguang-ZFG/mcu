"""check_pdf.py 的契约测试：PyMuPDF 现场造合成 PDF，正反双向校验。

夹具不复制校验规则——画页眉/页脚时直接调用 build_html 的纯函数
（running_header_map / header_skip_pages / header_label_for_page），
与被校验的 _stamp_page_numbers 同源；反向用例则逐项破坏契约，确认
check_pdf 会点名而不是静默放过。
"""

from __future__ import annotations

import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

import fitz  # PyMuPDF，造夹具与解析都靠它（requirements.txt 已钉 >=1.24）

BOOK_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BOOK_DIR))  # 与 `python mcu-book/check_pdf.py` 的导入路径一致

import build_html  # noqa: E402
import check_pdf  # noqa: E402

PAGE_COUNT = 10
TOC = [
    [1, "这不是文章合集，是一本书", 2],
    [1, "目录与分部目标", 3],
    [1, "第一部分 语法地基", 4],
    [2, "01 C0 为什么嵌入式 C 是另一种 C", 5],
    [2, "02 C1 内存模型", 8],
    [1, "附录 A 工程深读", 10],
]
MANIFEST = {
    "title": "合成样书",
    "subtitle": "校验夹具副标题",
    "author": "测试者",
    "version": "1.0.0",
    "date": "2026-10-25",
    "parts": [{"title": "第一部分 语法地基", "intro": "夹具", "files": ["a.md", "b.md"]}],
    "appendices": [{"file": "A.md", "title": "附录 A 工程深读"}],
}


def make_book_pdf(
    path: Path,
    manifest: dict,
    *,
    metadata_override: dict | None = None,
    drop_footer_page: int | None = None,
    extra_header_page: int | None = None,
    drop_outline_title: str | None = None,
) -> None:
    """复刻 _stamp_page_numbers 的产物形态：元数据 + 大纲 + 页眉 + 页脚。"""
    document = fitz.open()
    for _ in range(PAGE_COUNT):
        document.new_page(width=595, height=842)  # A4，单位 pt
    metadata = {
        "title": manifest["title"],
        "author": manifest["author"],
        "subject": manifest["subtitle"],
        "creator": "mcu-book/build_html.py",
    }
    if metadata_override:
        metadata.update(metadata_override)
    document.set_metadata(metadata)
    toc = [row for row in TOC if row[1] != drop_outline_title]
    document.set_toc(toc)

    marks = build_html.running_header_map(toc, manifest["title"])
    skip = build_html.header_skip_pages(toc)
    total = PAGE_COUNT - 1
    for index in range(1, PAGE_COUNT):
        page = document[index]
        page_number = index + 1
        if page_number not in skip:
            label = build_html.header_label_for_page(marks, manifest["title"], page_number)
            page.insert_textbox(
                fitz.Rect(45, 16, page.rect.width - 45, 34),
                label,
                fontname="china-s",
                fontsize=7.5,
                align=fitz.TEXT_ALIGN_CENTER,
                color=(0.45, 0.49, 0.47),
            )
        if page_number == drop_footer_page:
            continue
        label_num = f"{page_number} / {total}"
        width = fitz.get_text_length(label_num, fontname="helv", fontsize=8)
        page.insert_text(
            fitz.Point((page.rect.width - width) / 2, page.rect.height - 8),
            label_num,
            fontname="helv",
            fontsize=8,
            color=(0.38, 0.42, 0.40),
        )
    if extra_header_page is not None:
        page = document[extra_header_page - 1]
        page.insert_textbox(
            fitz.Rect(45, 16, page.rect.width - 45, 34),
            "多出来的页眉",
            fontname="china-s",
            fontsize=7.5,
            align=fitz.TEXT_ALIGN_CENTER,
        )
    document.save(path)
    document.close()


def run_check(pdf: Path, manifest_path: Path) -> tuple[int, str]:
    stdout, stderr = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
        code = check_pdf.main([str(pdf), "--manifest", str(manifest_path)])
    return code, stdout.getvalue() + stderr.getvalue()


class CheckPdfContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        tmp = Path(self._tmp.name)
        self.pdf = tmp / "book.pdf"
        self.manifest_path = tmp / "manifest.json"
        self.manifest_path.write_text(json.dumps(MANIFEST, ensure_ascii=False), encoding="utf-8")

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_complete_contract_passes(self) -> None:
        make_book_pdf(self.pdf, MANIFEST)
        code, output = run_check(self.pdf, self.manifest_path)
        self.assertEqual(0, code, output)
        self.assertIn("✓ 元数据与 manifest 一致", output)
        self.assertIn("✓ 大纲条目数", output)
        self.assertIn("✓ 封面无页脚页码", output)
        self.assertIn("✓ 除封面每页页脚为 N / total", output)
        self.assertIn("✓ 结构页（前言/目录/分部隔页）无页眉", output)
        self.assertIn("✓ 逐页页眉与映射一致", output)
        self.assertIn("✓ total 自洽", output)
        self.assertIn("check_pdf: PASS", output)

    def test_metadata_mismatch_is_named(self) -> None:
        make_book_pdf(self.pdf, MANIFEST, metadata_override={"title": "别的书"})
        code, output = run_check(self.pdf, self.manifest_path)
        self.assertEqual(1, code, output)
        self.assertIn("metadata.title", output)
        self.assertIn("别的书", output)
        self.assertIn("合成样书", output)

    def test_missing_footer_is_named(self) -> None:
        make_book_pdf(self.pdf, MANIFEST, drop_footer_page=5)
        code, output = run_check(self.pdf, self.manifest_path)
        self.assertEqual(1, code, output)
        self.assertIn("第 5 页", output)
        self.assertIn("页脚实际 ''", output)

    def test_extra_header_on_structural_page_is_named(self) -> None:
        # 第 4 页是分部隔页，属于 header_skip_pages 集合，多画页眉必须被点名。
        make_book_pdf(self.pdf, MANIFEST, extra_header_page=4)
        code, output = run_check(self.pdf, self.manifest_path)
        self.assertEqual(1, code, output)
        self.assertIn("第 4 页（结构页）", output)
        self.assertIn("多出来的页眉", output)

    def test_missing_outline_entry_is_named(self) -> None:
        make_book_pdf(self.pdf, MANIFEST, drop_outline_title="附录 A 工程深读")
        code, output = run_check(self.pdf, self.manifest_path)
        self.assertEqual(1, code, output)
        self.assertIn("大纲附录条目", output)
        self.assertIn("实际 0 条 vs 期望 1 条", output)

    def test_missing_pdf_file_fails_loudly(self) -> None:
        code, output = run_check(self.pdf, self.manifest_path)
        self.assertEqual(1, code, output)
        self.assertIn("PDF 不存在", output)


if __name__ == "__main__":
    unittest.main()
