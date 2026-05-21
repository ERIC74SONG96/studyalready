#!/usr/bin/env python3
"""Génère og-cover.png et assets/img/og/{slug}.png (1200×630) pour WhatsApp / Facebook."""

from __future__ import annotations

import json
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OG_DIR = ROOT / "assets" / "img" / "og"
COVER = ROOT / "assets" / "img" / "og-cover.png"
MANIFEST = OG_DIR / "manifest.json"
W, H = 1200, 630

SKIP_DIRS = {
    "admin",
    "admin-login",
    "offline",
    "assets",
    "scripts",
    "supabase",
    "node_modules",
    "dist",
    ".astro",
    ".git",
}
SKIP_FILES = {
    "admin.html",
    "dashboard.html",
    "offline.html",
    "google6b825c246d60bec6.html",
    "google670b42c1f0efa7d1.html",
}


def route_from_rel(rel: str) -> str:
    rel = rel.replace("\\", "/")
    if rel == "index.html":
        return "/"
    if rel.endswith("/index.html"):
        return "/" + rel[: -len("/index.html")]
    if rel.endswith(".html"):
        return "/" + rel[: -5]
    return "/"


def slug_from_route(route: str) -> str:
    return "home" if route == "/" else route.lstrip("/").replace("/", "--")


def title_from_html(html: str) -> str:
    m = re.search(r"<title>([\s\S]*?)</title>", html, re.I)
    if not m:
        return "StudyAlready"
    t = re.sub(r"\s+", " ", m.group(1)).strip()
    t = re.sub(r"\s*[|—–-]\s*StudyAlready\s*$", "", t, flags=re.I)
    return t or "StudyAlready"


def wrap_title(title: str, max_chars: int = 38, max_lines: int = 3) -> list[str]:
    words = title.split()
    lines: list[str] = []
    line = ""
    for word in words:
        test = f"{line} {word}".strip()
        if len(test) > max_chars and line:
            lines.append(line)
            line = word
        else:
            line = test
        if len(lines) >= max_lines:
            break
    if line and len(lines) < max_lines:
        lines.append(line)
    if len(lines) == max_lines and len(words) > len(" ".join(lines).split()):
        lines[-1] = (lines[-1][: max_chars - 1] + "…") if len(lines[-1]) > max_chars else lines[-1] + "…"
    return lines[:max_lines] or ["StudyAlready"]


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = []
    if bold:
        candidates += [
            "C:/Windows/Fonts/arialbd.ttf",
            "C:/Windows/Fonts/segoeuib.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        ]
    else:
        candidates += [
            "C:/Windows/Fonts/arial.ttf",
            "C:/Windows/Fonts/segoeui.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        ]
    for path in candidates:
        p = Path(path)
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()


def draw_card(
    title: str,
    *,
    subtitle: str = "Équivalence FWB · Belgique · Visa · Logement",
    badge: str = "STUDYALREADY",
    accent: tuple[int, int, int] = (245, 184, 0),
) -> Image.Image:
    img = Image.new("RGB", (W, H), (10, 37, 64))
    draw = ImageDraw.Draw(img)

    for y in range(H):
        t = y / H
        r = int(10 + (30 - 10) * t)
        g = int(37 + (58 - 37) * t)
        b = int(64 + (138 - 64) * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    draw.ellipse((820, -40, 1180, 320), fill=(30, 58, 100))
    draw.ellipse((-120, 380, 320, 720), fill=(30, 58, 138))
    draw.rounded_rectangle((56, 52, 1104, 578), radius=36, outline=(220, 230, 240), width=2)

    font_badge = load_font(30, bold=True)
    font_title = load_font(52, bold=True)
    font_sub = load_font(26)

    draw.text((80, 78), badge, fill=accent, font=font_badge)

    logo = Image.new("RGB", (88, 88), accent)
    ld = ImageDraw.Draw(logo)
    lf = load_font(40, bold=True)
    ld.text((44, 44), "SA", fill=(10, 37, 64), font=lf, anchor="mm")
    img.paste(logo, (80, 120))

    draw.text((188, 132), "Study", fill=(255, 255, 255), font=load_font(40, bold=True))
    tw = draw.textlength("Study", font=load_font(40, bold=True))
    draw.text((188 + tw + 4, 132), "Already", fill=accent, font=load_font(40, bold=True))

    y = 230
    for line in wrap_title(title):
        draw.text((80, y), line, fill=(255, 255, 255), font=font_title)
        y += 62

    draw.text((80, 500), subtitle, fill=(203, 213, 225), font=font_sub)
    draw.text((80, 552), "www.studyalready.com", fill=accent, font=load_font(22, bold=True))

    return img


def collect_pages() -> list[dict]:
    pages: list[dict] = []
    for path in sorted(ROOT.rglob("*.html")):
        rel = path.relative_to(ROOT).as_posix()
        if any(part in SKIP_DIRS for part in rel.split("/")):
            continue
        if path.name in SKIP_FILES:
            continue
        if rel.startswith("assets/"):
            continue
        if not (rel == "index.html" or rel.endswith("/index.html") or rel.count("/") == 0):
            if "/" in rel and not rel.endswith("/index.html"):
                continue
        html = path.read_text(encoding="utf-8", errors="replace")
        route = route_from_rel(rel)
        pages.append(
            {
                "rel": rel,
                "route": route,
                "slug": slug_from_route(route),
                "title": title_from_html(html),
            }
        )
    return pages


def main() -> None:
    OG_DIR.mkdir(parents=True, exist_ok=True)
    pages = collect_pages()
    manifest = []

    home = draw_card(
        "Étudier en Belgique, depuis le Cameroun.",
        subtitle="Inscription · Équivalence FWB · Visa · Compte bloqué · Logement",
    )
    home.save(COVER, "PNG", optimize=True)
    manifest.append({"slug": "home", "route": "/", "file": "og-cover.png"})

    seen: set[str] = set()
    for p in pages:
        slug = p["slug"]
        if slug in seen:
            continue
        seen.add(slug)
        sub = "Blog StudyAlready" if p["route"].startswith("/blog") else "Accompagnement étudiants · Belgique FWB"
        img = draw_card(p["title"], subtitle=sub)
        out = OG_DIR / f"{slug}.png"
        img.save(out, "PNG", optimize=True)
        manifest.append({"slug": slug, "route": p["route"], "file": f"og/{slug}.png"})

    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"OK: {COVER.name} + {len(seen)} images dans assets/img/og/")


if __name__ == "__main__":
    main()
