"""Generate Expo icons from clean OtelCore OC logo (full-bleed white bg)."""
from pathlib import Path
import shutil

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets"
SRC = Path(
    r"C:\Users\ilknuraslan\.cursor\projects\e-web-otelcore-com\assets"
    r"\c__Users_ilknuraslan_AppData_Roaming_Cursor_User_workspaceStorage"
    r"_04e11598f395e1d9e88f3fff22681408_images"
    r"_icon-5edfb047-f942-48ed-8fac-5b1f28e4cfe8.png"
)
# Keep a stable copy inside the project
SRC_LOCAL = OUT / "oc-logo-source.png"
NAVY = (29, 53, 87, 255)
WHITE = (255, 255, 255, 255)


def is_ink(r: int, g: int, b: int, a: int) -> bool:
    if a < 20:
        return False
    if r > 245 and g > 245 and b > 245:
        return False
    return True


def extract_logo(im: Image.Image) -> Image.Image:
    src = im.convert("RGBA")
    w, h = src.size
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sp, op = src.load(), out.load()
    min_x, min_y, max_x, max_y = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            r, g, b, a = sp[x, y]
            if not is_ink(r, g, b, a):
                continue
            op[x, y] = (r, g, b, a if a < 255 else 255)
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x)
            max_y = max(max_y, y)
    if max_x < 0:
        raise SystemExit("No logo ink found")
    pad = 4
    return out.crop(
        (
            max(0, min_x - pad),
            max(0, min_y - pad),
            min(w, max_x + 1 + pad),
            min(h, max_y + 1 + pad),
        )
    )


def contain_on_canvas(logo: Image.Image, size: int, fill: float, bg) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), bg)
    cw, ch = logo.size
    scale = (size * fill) / max(cw, ch)
    nw, nh = max(1, int(cw * scale)), max(1, int(ch * scale))
    resized = logo.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas.paste(resized, ((size - nw) // 2, (size - nh) // 2), resized)
    return canvas


def main() -> None:
    src = SRC if SRC.is_file() else SRC_LOCAL
    if not src.is_file():
        raise SystemExit(f"Missing logo source: {SRC}")
    OUT.mkdir(parents=True, exist_ok=True)
    if SRC.is_file():
        shutil.copy2(SRC, SRC_LOCAL)

    logo = extract_logo(Image.open(src))
    print("logo", logo.size)
    size = 1024

    # Solid white full-bleed + large centered OC (whole mark visible)
    icon = contain_on_canvas(logo, size, 0.90, WHITE)
    icon.convert("RGB").save(OUT / "icon.png", "PNG", optimize=True)

    splash = contain_on_canvas(logo, size, 0.55, NAVY)
    splash.save(OUT / "splash-icon.png", "PNG", optimize=True)

    fg = contain_on_canvas(logo, size, 0.72, (0, 0, 0, 0))
    fg.save(OUT / "android-icon-foreground.png", "PNG", optimize=True)
    Image.new("RGB", (size, size), (255, 255, 255)).save(
        OUT / "android-icon-background.png", "PNG"
    )

    mono = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    alpha = logo.split()[3]
    black = Image.new("RGBA", logo.size, (0, 0, 0, 255))
    black.putalpha(alpha)
    cw, ch = logo.size
    fill = int(size * 0.72)
    scale = fill / max(cw, ch)
    nw, nh = max(1, int(cw * scale)), max(1, int(ch * scale))
    black = black.resize((nw, nh), Image.Resampling.LANCZOS)
    mono.paste(black, ((size - nw) // 2, (size - nh) // 2), black)
    mono.save(OUT / "android-icon-monochrome.png", "PNG")

    icon.resize((48, 48), Image.Resampling.LANCZOS).save(OUT / "favicon.png", "PNG")

    notif = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    nm = mono.resize((72, 72), Image.Resampling.LANCZOS)
    white = Image.new("RGBA", nm.size, (255, 255, 255, 0))
    wp, mp = white.load(), nm.load()
    for y in range(nm.size[1]):
        for x in range(nm.size[0]):
            if mp[x, y][3] > 20:
                wp[x, y] = (255, 255, 255, mp[x, y][3])
    notif.paste(white, (12, 12), white)
    notif.save(OUT / "notification-icon.png", "PNG")

    px = icon.load()
    print("corner", px[0, 0], "center", px[512, 512], "->", OUT)


if __name__ == "__main__":
    main()
