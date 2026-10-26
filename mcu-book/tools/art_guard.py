"""art_guard：手绘题图结构断言（88 枚量产的机器门）。

每枚 SVG 必须：
1. viewBox="0 0 320 88"（横幅题花规格）
2. 滤镜 id 配对且唯一：<filter id="hw-<文件名>"> 且被 filter="url(#hw-<文件名>)" 引用；
   全部题图内联进同一 HTML 文档，prefix_local_ids 不改 filter="url(#…)"，
   id 撞车只能靠定义相同侥幸过关——所以逐图唯一。
3. 无 <image> / <script> / 外部链接（http/https/url(外链)）
4. 颜色不写死：fill=/stroke= 只许 "none" 或 var(--cover-ink, …)（暗色主题靠变量）
5. font-size ≥ 7（96mm 宽下 7 单位 ≈ 6pt，印刷地板）

御舆模式（--yuyu，2026-10-26 用户拍板的手绘路线 B）：
手绘感来自笔压与曲线，不靠滤镜——印前保持纯矢量可搜索。
1. viewBox="0 0 320 88" 不变。
2. 禁 filter/id=/href/src/url()（88 枚同页内联，无 id 即零撞车；无滤镜即印前零光栅化）。
3. 手绘感硬门：stroke-width ≥2 档（笔压分级）；曲线命令 C/Q/A ≥2 条为提示项（不阻塞）。
4. 无 <image>/<script>/<style>/外链；颜色只许 none 或 var(--cover-ink, …)。
5. font-size ≥ 7 不变。
6. 字节预算 ≤ 6000（预算逼着曲线复用，拒绝堆料）。
7. 文字必须完整落在 320×88 内（基线 y+降部 ≤ 88、上升部 ≥ 0）。实测 6 枚量产题图
   把基线写在 86..94，降部被静默裁掉——构建与印前 12 门都不报错，只有印刷尺寸可见。

用法：
    python mcu-book/tools/art_guard.py 图1.svg [图2.svg …]        # 滤镜模式
    python mcu-book/tools/art_guard.py --yuyu 图1.svg …           # 御舆模式
    python mcu-book/tools/art_guard.py --dir mcu-book/book/assets/chapter-art
    python mcu-book/tools/art_guard.py --yuyu --dir .temp/art
退出码：0 全过；1 有违规。
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

EXPECTED_VIEWBOX = 'viewBox="0 0 320 88"'
YUYU_MAX_BYTES = 6000


def _check_yuyu(path: Path, text: str, cr_errors: list[str]) -> list[str]:
    """御舆准入：无滤镜/id/引用，笔压分级，字节预算。"""
    errors = list(cr_errors)
    if EXPECTED_VIEWBOX not in text:
        m = re.search(r'viewBox="([^"]+)"', text)
        errors.append(f"viewBox 应为 0 0 320 88，实际 {m.group(1) if m else '缺失'}")
    for pat, label in [
        (r"<filter[\s>]", "<filter>（御舆路线不用滤镜，印前保持矢量）"),
        (r"\bid\s*=", "id=（88 枚同页内联，无 id 即零撞车）"),
        (r"(?:href|src)\s*=", "href/src 引用"),
        (r"url\(", "url() 引用"),
        (r"<image[\s>]", "<image> 位图"),
        (r"<script[\s>]", "<script>"),
        (r"<style[\s>]", "<style>"),
        (r"url\(https?://", "外链 url()"),
    ]:
        if re.search(pat, text):
            errors.append(f"违规内容：{label}")
    size = len(text.encode("utf-8"))
    if size > YUYU_MAX_BYTES:
        errors.append(f"{size} 字节超御舆预算 {YUYU_MAX_BYTES}")
    # 笔压分级是硬信号（御舆原作 5 枚里 3 枚曲线数 <2，直线+圆也是合法习语，
    # 所以曲线命令只作提示，不许把量产逼成"为过门而画"）
    d_attrs = re.findall(r'\bd="([^"]+)"', text)
    curves = sum(1 for d in d_attrs for _ in re.findall(r"[CcQqAa]", d))
    if curves < 2:
        print(f"  ⚠ {path.name}: 曲线命令 {curves} 条（<2，提示：可加曲线增强手绘感，不强制）")
    widths = {float(w) for w in re.findall(r'stroke-width="([\d.]+)"', text)}
    if len(widths) < 2:
        errors.append(f"stroke-width 仅 {len(widths)} 档 {sorted(widths)}（笔压分级要求 ≥2 档）")
    for m in re.finditer(r'(?:fill|stroke)="([^"]+)"', text):
        v = m.group(1)
        if v != "none" and not v.startswith("var(--cover-ink"):
            errors.append(f"颜色写死 {v!r}（只许 none 或 var(--cover-ink, …)）")
    for m in re.finditer(r'font-size="([\d.]+)"', text):
        if float(m.group(1)) < 7:
            errors.append(f"font-size {m.group(1)} < 7（印刷地板）")
    # 文字必须完整落在 320×88 画布内：基线越界时字形上升/降部被静默裁掉，
    # 而 get_text() 与构建都不报错。2026-10-26 实测 6 枚题图基线 y≥86 被裁。
    # 系数取实测上界：字号 s 的字框顶 ≈ y-0.95s，底 ≈ y+0.28s。
    for m in re.finditer(r'<text\b[^>]*>', text):
        tag = m.group(0)
        ym = re.search(r'\by="([\d.]+)"', tag)
        sm = re.search(r'font-size="([\d.]+)"', tag)
        if not (ym and sm):
            continue
        y, s = float(ym.group(1)), float(sm.group(1))
        if y + 0.28 * s > 88.5:
            errors.append(f"文字基线 y={ym.group(1)} + 降部超出画布下缘"
                          f"（{y + 0.28 * s:.1f} > 88）")
        if y - 0.95 * s < -0.5:
            errors.append(f"文字基线 y={ym.group(1)} + 上升部超出画布上缘")
    return errors


def check_svg(path: Path, yuyu: bool = False) -> list[str]:
    # 读字节判 CRLF：read_text 的 universal newlines 会把 \r\n 解码成 \n，文本层判不出来
    if b"\r" in path.read_bytes():
        cr_errors = ["含 CR（必须纯 LF 落盘）"]
    else:
        cr_errors = []
    text = path.read_text(encoding="utf-8")
    stem = path.stem
    errors: list[str] = cr_errors

    if yuyu:
        return _check_yuyu(path, text, cr_errors)

    if EXPECTED_VIEWBOX not in text:
        m = re.search(r'viewBox="([^"]+)"', text)
        errors.append(f"viewBox 应为 0 0 320 88，实际 {m.group(1) if m else '缺失'}")

    fid = f"hw-{stem}"
    if f'id="{fid}"' not in text:
        errors.append(f'缺 <filter id="{fid}">（滤镜 id 必须 = hw-<文件名>）')
    if f'url(#{fid})' not in text:
        errors.append(f"缺 filter=\"url(#{fid})\" 引用（定义了没人用）")
    # 冻结的笔触参数（与封面/分部隔页同源），防批次间分叉
    if 'baseFrequency="0.013"' not in text:
        errors.append('feTurbulence baseFrequency 必须 0.013（冻结值）')
    if 'scale="3.2"' not in text:
        errors.append('feDisplacementMap scale 必须 3.2（冻结值）')
    # id 撞车：任意 id 出现多次定义即违规
    ids = re.findall(r'id="([^"]+)"', text)
    for dup in {i for i in ids if ids.count(i) > 1}:
        errors.append(f'id "{dup}" 重复定义')
    # 悬空引用：每个 url(#…) 必须指向本文件已定义的 id——
    # 浏览器对悬空引用静默丢弃整个元素，图变空白但构建与 12 门都不报错
    for ref in re.findall(r'url\(#([^)]+)\)', text):
        if ref not in ids:
            errors.append(f'悬空引用 url(#{ref})：本文件无此 id，该元素会被静默丢弃')

    for pat, label in [
        (r"<image[\s>]", "<image> 位图"),
        (r"<script[\s>]", "<script>"),
        (r'(?:href|src)\s*=\s*"https?://', "外链 href/src"),
        (r"url\(https?://", "外链 url()"),
    ]:
        if re.search(pat, text):
            errors.append(f"违规内容：{label}")

    for m in re.finditer(r'(?:fill|stroke)="([^"]+)"', text):
        v = m.group(1)
        if v != "none" and not v.startswith("var(--cover-ink"):
            errors.append(f"颜色写死 {v!r}（只许 none 或 var(--cover-ink, …)）")

    for m in re.finditer(r'font-size="([\d.]+)"', text):
        if float(m.group(1)) < 7:
            errors.append(f"font-size {m.group(1)} < 7（印刷地板）")
    return errors


def main() -> int:
    argv = sys.argv[1:]
    if not argv:
        print(__doc__)
        return 2
    yuyu = False
    if argv[0] == "--yuyu":
        yuyu = True
        argv = argv[1:]
    if argv and argv[0] == "--dir":
        files = sorted(Path(argv[1]).glob("*.svg"))
    else:
        files = [Path(a) for a in argv]
    total = 0
    ids_seen: dict[str, str] = {}
    for f in files:
        errs = check_svg(f, yuyu)
        if not yuyu:
            # 跨文件滤镜 id 唯一性（御舆模式无 id，不适用）
            m = re.search(r'id="(hw-[^"]+)"', f.read_text(encoding="utf-8"))
            if m:
                if m.group(1) in ids_seen:
                    errs.append(f'滤镜 id {m.group(1)} 与 {ids_seen[m.group(1)]} 撞车')
                ids_seen[m.group(1)] = f.name
        total += len(errs)
        print(f"{f.name:<32} {'✓' if not errs else '✗'}")
        for e in errs:
            print(f"  {e}")
    print(f"\n{len(files)} 枚，违规 {total} 处")
    return 1 if total else 0


if __name__ == "__main__":
    raise SystemExit(main())
