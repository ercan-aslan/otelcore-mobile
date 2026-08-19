#!/usr/bin/env python3
"""Generate Expo app icons from My Stone Inn square logo."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT.parent / "mystoneinn" / "uploads" / "img" / "logo-kare.webp"
OUT = ROOT / "assets"
BG = (244, 246, 249, 255)  # #f4f6f9 — matches app.json splash background


def fit_on_canvas(image: Image.Image, size: int, padding_ratio: float = 0.12) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), BG)
    usable = int(size * (1 - padding_ratio * 2))
    fitted = ImageOps.contain(image, (usable, usable), method=Image.Resampling.LANCZOS)
    offset = ((size - fitted.width) // 2, (size - fitted.height) // 2)
    canvas.alpha_composite(fitted, offset)
    return canvas


def to_monochrome(image: Image.Image, size: int) -> Image.Image:
    rgba = fit_on_canvas(image, size, padding_ratio=0.14)
    alpha = rgba.split()[3]
    mono = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    black = Image.new("L", (size, size), 0)
    mono.putalpha(alpha)
    # Recolor non-transparent pixels to black for Android monochrome slot.
    result = Image.new("RGBA", (size, size), (0, 0, 0, 255))
    result.putalpha(alpha)
    return result


def main() -> None:
    if not SRC.is_file():
        raise SystemExit(f"Logo not found: {SRC}")

    OUT.mkdir(parents=True, exist_ok=True)
    logo = Image.open(SRC).convert("RGBA")

    icon = fit_on_canvas(logo, 1024, padding_ratio=0.1)
    icon.save(OUT / "icon.png", format="PNG", optimize=True)

    splash = fit_on_canvas(logo, 512, padding_ratio=0.08)
    splash.save(OUT / "splash-icon.png", format="PNG", optimize=True)

    foreground = fit_on_canvas(logo, 1024, padding_ratio=0.18)
    foreground.save(OUT / "android-icon-foreground.png", format="PNG", optimize=True)

    background = Image.new("RGBA", (1024, 1024), BG)
    background.save(OUT / "android-icon-background.png", format="PNG", optimize=True)

    monochrome = to_monochrome(logo, 1024)
    monochrome.save(OUT / "android-icon-monochrome.png", format="PNG", optimize=True)

    favicon = fit_on_canvas(logo, 48, padding_ratio=0.08)
    favicon.save(OUT / "favicon.png", format="PNG", optimize=True)

    print(f"Generated icons in {OUT} from {SRC}")


if __name__ == "__main__":
    main()
