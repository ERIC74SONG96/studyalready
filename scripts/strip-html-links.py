#!/usr/bin/env python3
"""Replace internal .html links with clean URLs (site-wide)."""
from __future__ import annotations
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRS = {"scripts", "node_modules", ".git", "assets/js/vendor", "assets/docs"}
SKIP_FILES = {"google6b825c246d60bec6.html", "logo-preview.html"}

# href="index.html" -> href="/"
INDEX_PAT = re.compile(
    r'(?<=[\s"\'>])(?:\.\./)*index\.html(?=[\s"\'#?]|$)',
    re.IGNORECASE,
)

def should_process(path: Path) -> bool:
    if path.suffix.lower() not in {".html", ".js", ".mjs"}:
        return False
    if path.name in SKIP_FILES:
        return False
    parts = path.relative_to(ROOT).parts
    for d in SKIP_DIRS:
        if d in parts:
            return False
    return True

def strip_html_in_text(text: str) -> str:
    # index.html special cases first
    text = re.sub(r'href=(["\'])(?:\.\./)*index\.html\1', r'href=\1/\1', text, flags=re.I)
    text = re.sub(r'href=(["\'])(?:\.\./)*index\.html#', r'href=\1/#', text, flags=re.I)
    text = re.sub(r'href=(["\'])(?:\.\./)*index\.html\?', r'href=\1/?', text, flags=re.I)
    text = re.sub(r'content=(["\'])https://www\.studyalready\.com/index\.html\1', r'content=\1https://www.studyalready.com/\1', text, flags=re.I)
    text = re.sub(r'https://www\.studyalready\.com/index\.html', 'https://www.studyalready.com/', text, flags=re.I)

    # canonical / og:url with .html
    text = re.sub(
        r'(https://www\.studyalready\.com/)([^"\'\s>?#]+)\.html',
        r'\1\2',
        text,
        flags=re.I,
    )

    # Relative .html in href, action, content paths (not in regex test for .html files as filenames in code comments carefully)
    def repl_href(m: re.Match) -> str:
        quote = m.group(1)
        path = m.group(2)
        if path.endswith(".html"):
            path = path[:-5]
        if path == "index":
            path = "/"
        return f'href={quote}{path}{quote}'

    text = re.sub(
        r'href=(["\'])((?:\.\./|/)*[^"\']+?)\.html\1',
        repl_href,
        text,
        flags=re.I,
    )

    # action="foo.html"
    text = re.sub(
        r'action=(["\'])([^"\']+?)\.html\1',
        lambda m: f'action={m.group(1)}{m.group(2) if m.group(2) != "index" else "/"}{m.group(1)}',
        text,
        flags=re.I,
    )

    # JS path checks like /rejoindre-reseau\.html/
    text = re.sub(
        r'/(rejoindre-reseau|communaute|annuaire)\.html',
        r'/\1',
        text,
        flags=re.I,
    )
    text = re.sub(
        r'rejoindre-reseau\.html',
        'rejoindre-reseau',
        text,
        flags=re.I,
    )
    text = re.sub(
        r'communaute\.html',
        'communaute',
        text,
        flags=re.I,
    )

    # JS: P + 'page.html', link(P + 'page.html', …)
    text = re.sub(
        r"(\+ ['\"])index\.html#",
        r"\1/#",
        text,
        flags=re.I,
    )
    text = re.sub(
        r"(\+ ['\"])index\.html(['\"])",
        r"\1/\2",
        text,
        flags=re.I,
    )
    text = re.sub(
        r"(['\"])((?:\.\./|[a-z0-9-]+/)*[a-z0-9-]+)\.html(['\"])",
        lambda m: f"{m.group(1)}{m.group(2)}{m.group(3)}",
        text,
        flags=re.I,
    )

    # JS URLs with query: 'page.html?…'
    text = re.sub(
        r"(['\"])([a-z0-9./_-]+)\.html(\?)",
        r"\1\2\3",
        text,
        flags=re.I,
    )

    # Absolute /path.html in JS
    text = re.sub(r"(['\"])/index\.html", r"\1/", text, flags=re.I)
    text = re.sub(
        r"(['\"])/([^'\"]+)\.html",
        lambda m: f"{m.group(1)}/{m.group(2)}",
        text,
        flags=re.I,
    )

    # window.location.*('relative.html')
    text = re.sub(
        r"(replace|href)\s*=\s*['\"]([^'\"]+)\.html",
        lambda m: f"{m.group(1)} = '{m.group(2)}'",
        text,
        flags=re.I,
    )
    text = re.sub(
        r"location\.replace\(\s*['\"]([^'\"]+)\.html",
        r"location.replace('\1",
        text,
        flags=re.I,
    )

    return text

def main() -> None:
    changed = []
    for path in ROOT.rglob("*"):
        if not path.is_file() or not should_process(path):
            continue
        original = path.read_text(encoding="utf-8")
        updated = strip_html_in_text(original)
        if updated != original:
            path.write_text(updated, encoding="utf-8", newline="\n")
            changed.append(path.relative_to(ROOT))
    print(f"Updated {len(changed)} files")
    for p in sorted(changed)[:40]:
        print(f"  {p}")
    if len(changed) > 40:
        print(f"  ... and {len(changed) - 40} more")

if __name__ == "__main__":
    main()
