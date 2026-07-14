#!/usr/bin/env python3
"""stitch.py - 結合済みMarkdown内で、ページ境界に分断された連続テーブルを結合する。

assemble.sh が生成した <version>.md は、ページ単位の機械結合のため、ページを
またぐテーブルが「同一ヘッダのテーブル + 区切り(---・コメント・ページ脚注) +
同一ヘッダのテーブル」に分断される。本スクリプトはそれを1つのテーブルに結合する。

ルール:
- 連続する2つのGFMテーブルが、間に「無視可能な行」だけを挟み、かつヘッダ行が
  同一なら結合する(後続テーブルのヘッダ・区切り行を除去し、データ行を前テーブルに連結。
  間の無視可能行も除去)。
- 無視可能な行 = 空行 / `---` / `© JAHIS 2024` / 単一行HTMLコメント `<!-- ... -->`

使い方: stitch.py <markdown-file>   (ファイルをその場で書き換える)
"""
import re
import sys


def is_page_footer(line):
    # 「© JAHIS 2024」などのページ脚注(年は版により異なる)
    return bool(re.match(r"^©\s*JAHIS\s*\d{4}$", line.strip()))


def is_ignorable(line):
    s = line.strip()
    if s == "" or s == "---" or is_page_footer(line):
        return True
    if s.startswith("<!--") and s.endswith("-->"):
        return True
    return False


def is_table_row(line):
    s = line.strip()
    return s.startswith("|") and s.endswith("|")


def is_separator_row(line):
    s = line.strip()
    # |---|---| 形式(コロン揃え対応)
    return bool(re.match(r"^\|(\s*:?-+:?\s*\|)+$", s))


def norm(line):
    # ヘッダ比較用: 空白差(全角/半角・有無)を無視するため空白を全除去する
    return re.sub(r"\s+", "", line.strip())


def parse_segments(lines):
    """行を [('table', header, sep, [rows], start, end)] と ('other', line) に分割。"""
    segments = []
    i = 0
    n = len(lines)
    while i < n:
        if (
            is_table_row(lines[i])
            and i + 1 < n
            and is_separator_row(lines[i + 1])
        ):
            header = lines[i]
            sep = lines[i + 1]
            rows = []
            j = i + 2
            while j < n and is_table_row(lines[j]) and not is_separator_row(lines[j]):
                rows.append(lines[j])
                j += 1
            segments.append(["table", header, sep, rows])
            i = j
        else:
            segments.append(["other", lines[i]])
            i += 1
    return segments


def stitch(text):
    lines = text.split("\n")
    segments = parse_segments(lines)

    out = []
    idx = 0
    n = len(segments)
    while idx < n:
        seg = segments[idx]
        if seg[0] != "table":
            out.append(("other", seg[1]))
            idx += 1
            continue

        # テーブル開始。後続の「無視可能 only + 同一ヘッダテーブル」を貪欲に結合
        header, sep, rows = seg[1], seg[2], list(seg[3])
        idx += 1
        while True:
            # 次のテーブルまでの間に挟まる other 群を覗き見る
            look = idx
            buffer = []
            while look < n and segments[look][0] == "other":
                buffer.append(segments[look][1])
                look += 1
            if (
                look < n
                and segments[look][0] == "table"
                and norm(segments[look][1]) == norm(header)
                and all(is_ignorable(b) for b in buffer)
            ):
                # 結合: 間の other(無視可能)を捨て、後続テーブルのデータ行のみ取り込む
                rows.extend(segments[look][3])
                idx = look + 1
                continue
            break

        out.append(("table", (header, sep, rows)))

    # 再構築
    result = []
    for kind, payload in out:
        if kind == "other":
            result.append(payload)
        else:
            header, sep, rows = payload
            result.append(header)
            result.append(sep)
            result.extend(rows)
    return "\n".join(result)


def cleanup(text):
    """読み物用の整形: ページ脚注(© JAHIS 2024)を除去し、3行以上の連続空行を2行に圧縮。"""
    out = []
    blanks = 0
    for line in text.split("\n"):
        if is_page_footer(line):
            continue
        if line.strip() == "---":  # ページ区切り由来の水平線を除去
            continue
        if line.strip() == "":
            blanks += 1
            if blanks <= 2:
                out.append(line)
        else:
            blanks = 0
            out.append(line)
    return "\n".join(out)


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: stitch.py <markdown-file>")
    path = sys.argv[1]
    with open(path, encoding="utf-8") as f:
        text = f.read()
    stitched = stitch(text)
    stitched = cleanup(stitched)
    with open(path, "w", encoding="utf-8") as f:
        f.write(stitched)
    print(f"stitched -> {path}")


if __name__ == "__main__":
    main()
