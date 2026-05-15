#!/usr/bin/env python3
"""Dossiers /chemin/index.html pour URLs sans .html (sans mod_rewrite)."""
from __future__ import annotations
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRS = {
    "assets",
    "scripts",
    "node_modules",
    ".git",
    "supabase",
    "tools",
    "_bundle_tmp",
    "mcps",
    "downloads",
}
SKIP_FILES = {
    "google6b825c246d60bec6.html",
    "logo-preview.html",
}
# Déjà servis comme index de dossier (pas de doublon page/index.html)
SKIP_INDEX_IN = {
    ("blog", "index.html"),
    ("espace-etudiant", "index.html"),
}


def public_url_path(source: Path) -> str:
    rel = source.relative_to(ROOT)
    parts = list(rel.with_suffix("").parts)
    if parts and parts[-1] == "index":
        parts = parts[:-1]
    return "/".join(parts).replace("\\", "/")


def normalize_paths(text: str, source: Path) -> str:
    text = re.sub(r'((?:href|src)=["\'])\.\./', r"\1/", text)
    if "blog" in source.parts and source.parent.name == "blog":
        text = re.sub(r'((?:href|src)=["\'])\./', r"\1/blog/", text)
    return text


def update_canonicals(text: str, url_path: str) -> str:
    if not url_path or url_path == "index":
        clean = "https://www.studyalready.com/"
    else:
        clean = f"https://www.studyalready.com/{url_path}/"
    text = re.sub(
        rf"https://www\.studyalready\.com/{re.escape(url_path)}\.html",
        clean.rstrip("/") if url_path == "index" else clean,
        text,
        flags=re.I,
    )
    text = re.sub(
        rf"(https://www\.studyalready\.com/)({re.escape(url_path)})(?=[\"'\s>])",
        lambda m: clean.rstrip("/") if url_path == "index" else clean,
        text,
        flags=re.I,
    )
    return text


def build_alias(source: Path) -> str:
    text = source.read_text(encoding="utf-8")
    url_path = public_url_path(source)
    if re.search(r"<base\s", text, re.I) is None:
        text = re.sub(
            r"(<head[^>]*>)",
            r'\1\n  <base href="/" />',
            text,
            count=1,
            flags=re.I,
        )
    text = normalize_paths(text, source)
    text = update_canonicals(text, url_path)
    return text


def should_process(path: Path) -> bool:
    if path.name in SKIP_FILES:
        return False
    if path.suffix.lower() != ".html":
        return False
    rel = path.relative_to(ROOT)
    if any(part in SKIP_DIRS for part in rel.parts):
        return False
    if rel.parts == ("index.html",):
        return False
    if tuple(rel.parts) in SKIP_INDEX_IN:
        return False
    if path.name == "index.html" and path.parent != ROOT:
        return False
    return True


def out_dir_for(source: Path) -> Path:
    return source.parent / source.stem


def main() -> None:
    created: list[Path] = []
    for path in sorted(ROOT.rglob("*.html")):
        if not should_process(path):
            continue
        out_dir = out_dir_for(path)
        out_dir.mkdir(parents=True, exist_ok=True)
        out_file = out_dir / "index.html"
        out_file.write_text(build_alias(path), encoding="utf-8", newline="\n")
        created.append(out_dir.relative_to(ROOT))
    print(f"Created/updated {len(created)} URL folders")
    for p in created:
        print(f"  {p}/")


if __name__ == "__main__":
    main()
