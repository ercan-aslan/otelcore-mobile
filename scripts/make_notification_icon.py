"""Build Android notification icon: white silhouette, transparent BG, max fill."""
from PIL import Image

SRC = r"C:\Users\90530\Downloads\mystoneinn-mobile\assets\icon.png"
OUT = r"C:\Users\90530\Downloads\mystoneinn-mobile\assets\notification-icon.png"
SIZE = 96
# Strong center zoom so line-art fills the notification tile
ZOOM = 1.38


def to_white_mask(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    pixels = im.load()
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    op = out.load()

    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a < 16:
                continue
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            if lum < 185:
                op[x, y] = (255, 255, 255, 255)
    return out


def main() -> None:
    mask = to_white_mask(Image.open(SRC))
    box = mask.getbbox()
    if not box:
        raise SystemExit("empty icon")

    cropped = mask.crop(box)
    cw, ch = cropped.size

    zw, zh = max(8, int(cw / ZOOM)), max(8, int(ch / ZOOM))
    left = (cw - zw) // 2
    top = max(0, (ch - zh) // 2 - int(ch * 0.03))
    cropped = cropped.crop((left, top, left + zw, top + zh))
    cw, ch = cropped.size

    # Cover-scale: fill entire 96x96 (may clip tiny edges)
    scale = max(SIZE / cw, SIZE / ch)
    nw, nh = max(SIZE, int(round(cw * scale))), max(SIZE, int(round(ch * scale)))
    scaled = cropped.resize((nw, nh), Image.Resampling.LANCZOS)
    left2 = (nw - SIZE) // 2
    top2 = (nh - SIZE) // 2
    canvas = scaled.crop((left2, top2, left2 + SIZE, top2 + SIZE)).convert("RGBA")

    px = canvas.load()
    for y in range(SIZE):
        for x in range(SIZE):
            if px[x, y][3] > 40:
                px[x, y] = (255, 255, 255, 255)
            else:
                px[x, y] = (0, 0, 0, 0)

    canvas.save(OUT, "PNG")

    preview = Image.new("RGBA", (SIZE * 4, SIZE * 4), (0, 0, 0, 255))
    big = canvas.resize((SIZE * 4, SIZE * 4), Image.Resampling.NEAREST)
    preview.paste(big, (0, 0), big)
    preview.save(OUT.replace("notification-icon.png", "_notif_preview_tmp.png"), "PNG")

    opaque = sum(1 for y in range(SIZE) for x in range(SIZE) if px[x, y][3] > 0)
    print(f"saved {OUT} zoom={ZOOM} opaque={opaque / (SIZE * SIZE):.0%}")


if __name__ == "__main__":
    main()
