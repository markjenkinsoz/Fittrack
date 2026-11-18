#!/usr/bin/env python3
"""Generate FitTrack PWA icons (apple-touch, 192, 512, maskable)."""
from PIL import Image, ImageDraw, ImageFilter
import math
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent


def lerp(a, b, t):
    return int(a + (b - a) * t)


def make_icon(size, pad_ratio=0.0):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    cx = cy = size / 2
    c1 = (11, 16, 26, 255)
    c2 = (26, 38, 56, 255)
    c3 = (8, 11, 18, 255)
    maxr = math.hypot(cx, cy)
    for y in range(size):
        for x in range(size):
            r = math.hypot(x - cx, y - cy) / maxr
            if r < 0.55:
                t = r / 0.55
                col = tuple(lerp(c2[i], c1[i], t) for i in range(4))
            else:
                t = (r - 0.55) / 0.45
                col = tuple(lerp(c1[i], c3[i], min(t, 1)) for i in range(4))
            px[x, y] = col

    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    gr = int(size * 0.28)
    g.ellipse([cx - gr, cy - gr, cx + gr, cy + gr], fill=(62, 224, 176, 48))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=size * 0.08))
    img = Image.alpha_composite(img, glow)
    draw = ImageDraw.Draw(img)

    def ring(radius, width, start_deg, sweep_deg, color):
        bbox = [cx - radius, cy - radius, cx + radius, cy + radius]
        draw.arc(bbox, start=start_deg, end=start_deg + sweep_deg, fill=color, width=width)
        for ang in (start_deg, start_deg + sweep_deg):
            rad = math.radians(ang)
            x = cx + radius * math.cos(rad)
            y = cy + radius * math.sin(rad)
            cap = width / 2
            draw.ellipse([x - cap, y - cap, x + cap, y + cap], fill=color)

    inset = size * (0.14 + pad_ratio * 0.5)
    radius = size / 2 - inset
    width = max(6, int(size * 0.07))
    track = (42, 54, 72, 255)

    bbox = [cx - radius, cy - radius, cx + radius, cy + radius]
    draw.arc(bbox, start=0, end=360, fill=track, width=width)
    ring(radius, width, -90, 270, (62, 224, 176, 255))

    radius2 = radius - width - max(4, size * 0.02)
    width2 = max(4, int(size * 0.035))
    bbox2 = [cx - radius2, cy - radius2, cx + radius2, cy + radius2]
    draw.arc(bbox2, start=0, end=360, fill=track, width=width2)
    ring(radius2, width2, -90, 200, (122, 168, 255, 255))

    inner = radius2 - width2
    bar_w = inner * 1.15
    bar_h = max(3, size * 0.045)
    weight_w = inner * 0.22
    weight_h = inner * 0.72
    end_w = inner * 0.12
    end_h = inner * 0.48
    col = (244, 247, 251, 255)
    draw.rounded_rectangle(
        [cx - bar_w / 2, cy - bar_h / 2, cx + bar_w / 2, cy + bar_h / 2],
        radius=bar_h / 2,
        fill=col,
    )
    for sign in (-1, 1):
        lx = cx + sign * (bar_w / 2 - weight_w * 0.15)
        draw.rounded_rectangle(
            [
                lx - sign * weight_w / 2 - weight_w / 2,
                cy - weight_h / 2,
                lx - sign * weight_w / 2 + weight_w / 2,
                cy + weight_h / 2,
            ],
            radius=weight_w * 0.35,
            fill=col,
        )
        sx = lx - sign * (weight_w * 0.85)
        draw.rounded_rectangle(
            [sx - end_w / 2, cy - end_h / 2, sx + end_w / 2, cy + end_h / 2],
            radius=end_w * 0.4,
            fill=col,
        )
    return img


def main():
    for s, path in [
        (180, OUT / "apple-touch-icon.png"),
        (192, OUT / "icons" / "icon-192.png"),
        (512, OUT / "icons" / "icon-512.png"),
    ]:
        path.parent.mkdir(parents=True, exist_ok=True)
        make_icon(s, 0).save(path, "PNG")
        print("wrote", path)
    for s, path in [
        (192, OUT / "icons" / "icon-192-maskable.png"),
        (512, OUT / "icons" / "icon-512-maskable.png"),
    ]:
        make_icon(s, 0.12).save(path, "PNG")
        print("wrote", path)


if __name__ == "__main__":
    main()
