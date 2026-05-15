#!/usr/bin/env python3
"""Dossiers /page/ avec index.html pour URLs sans .html (sans mod_rewrite)."""
from __future__ import annotations
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP = {
    "index",
    "404",
    "jobs-etudiants",
    "google6b825c246d60bec6",
    "dashboard",
}


def build_alias(slug: str, source: Path) -> str:
    text = source.read_text(encoding="utf-8")
    if re.search(r"<base\s", text, re.I) is None:
        text = re.sub(r"(<head[^>]*>)", r'\1\n  <base href="/" />', text, count=1, flags=re.I)
    text = re.sub(
        rf"(https://www\.studyalready\.com/){re.escape(slug)}\.html",
        rf"\1{slug}/",
        text,
        flags=re.I,
    )
    return text


def main() -> None:
    created = []
    for path in sorted(ROOT.glob("*.html")):
        slug = path.stem
        if slug in SKIP:
            continue
        out_dir = ROOT / slug
        out_dir.mkdir(exist_ok=True)
        out_file = out_dir / "index.html"
        out_file.write_text(build_alias(slug, path), encoding="utf-8", newline="\n")
        created.append(out_dir.relative_to(ROOT))
    print(f"Created/updated {len(created)} URL folders")
    for p in created[:15]:
        print(f"  {p}/")
    if len(created) > 15:
        print(f"  ... and {len(created) - 15} more")


if __name__ == "__main__":
    main()
