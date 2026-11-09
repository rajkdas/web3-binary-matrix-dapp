#!/usr/bin/env python3
"""Generate PortaGraph brand assets: favicon.ico, apple-icon.png,
social-preview.png (1280x640) and banner.png (1280x400)."""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = "/home/z/my-project"
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

INDIGO = (99, 102, 241)
VIOLET = (139, 92, 246)
EMERALD = (16, 185, 129)
NAVY_A = (17, 24, 52)
NAVY_B = (29, 18, 70)
LINE = (165, 180, 252)
SOFT = (199, 210, 254)


def font(sz, bold=True):
    return ImageFont.truetype(BOLD if bold else REG, sz)


def vertical_gradient(w, h, top, bottom):
    strip = Image.new("RGB", (1, 2))
    strip.putpixel((0, 0), top)
    strip.putpixel((0, 1), bottom)
    return strip.resize((w, h))


def glow_ellipse(base, cx, cy, rx, ry, color, alpha, blur):
    ov = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=color + (alpha,))
    base.alpha_composite(ov.filter(ImageFilter.GaussianBlur(blur)))


def draw_tree(dr, ox, oy, scale, lw, glow_layer=None):
    """Binary tree: root emerald, L1 indigo, L2 violet. Coords in 64-box, scaled."""
    nodes = {0: (32, 18, 6.0), 1: (20, 34, 5.0), 2: (44, 34, 5.0),
             3: (14, 50, 4.0), 4: (26, 50, 4.0), 5: (38, 50, 4.0), 6: (50, 50, 4.0)}
    edges = [(0, 1), (0, 2), (1, 3), (1, 4), (2, 5), (2, 6)]

    def P(i):
        x, y, _ = nodes[i]
        return (ox + x * scale, oy + y * scale)

    for a, b in edges:
        dr.line([P(a), P(b)], fill=LINE + (150,), width=int(lw))
    for i, (x, y, r) in nodes.items():
        col = EMERALD if i == 0 else (INDIGO if i in (1, 2) else VIOLET)
        rr = r * scale
        cx, cy = P(i)
        if glow_layer is not None:
            glow_layer.ellipse([cx - rr * 1.9, cy - rr * 1.9, cx + rr * 1.9, cy + rr * 1.9],
                               fill=col + (90,))
        dr.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=col + (255,))


def fit_font(dr, text, max_w, start, bold=True):
    sz = start
    while sz > 10:
        f = font(sz, bold)
        if dr.textbbox((0, 0), text, font=f)[2] <= max_w:
            return f
        sz -= 2
    return font(10, bold)


def chip(dr, x, y, text, fsz=26):
    f = font(fsz)
    bb = dr.textbbox((0, 0), text, font=f)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    padx, pady = 20, 13
    dr.rounded_rectangle([x, y, x + tw + padx * 2, y + th + pady * 2 + 6],
                         radius=(th + pady * 2 + 6) / 2,
                         fill=(255, 255, 255, 14), outline=VIOLET + (150,), width=2)
    dr.text((x + padx, y + pady - bb[1] + 3), text, font=f, fill=SOFT)
    return tw + padx * 2


def make_canvas(w, h):
    img = vertical_gradient(w, h, NAVY_A, NAVY_B).convert("RGBA")
    glow_ellipse(img, int(w * 0.16), int(h * 0.5), int(w * 0.30), int(h * 0.55), INDIGO, 46, 120)
    glow_ellipse(img, int(w * 0.86), int(h * 0.25), int(w * 0.26), int(h * 0.5), VIOLET, 42, 120)
    glow_ellipse(img, int(w * 0.78), int(h * 0.95), int(w * 0.20), int(h * 0.35), EMERALD, 26, 120)
    # subtle dot grid
    dg = ImageDraw.Draw(img)
    step = int(w / 46)
    for yy in range(step // 2, h, step):
        for xx in range(step // 2, w, step):
            dg.ellipse([xx - 1, yy - 1, xx + 1, yy + 1], fill=(255, 255, 255, 9))
    return img


def make_preview():
    W, H = 1280, 640
    img = make_canvas(W, H)
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    dr = ImageDraw.Draw(img)
    draw_tree(dr, 40, 60, 8.2, 11, gd)
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(22)))

    tx = 640
    dr = ImageDraw.Draw(img)
    f_title = fit_font(dr, "BinaryMatrix", 610, 118)
    dr.text((tx, 130), "BinaryMatrix", font=f_title, fill=(255, 255, 255))
    sub = "A Web3 binary-matrix dApp"
    f_sub = fit_font(dr, sub, 600, 38)
    dr.text((tx, 288), sub, font=f_sub, fill=SOFT)
    dr.text((tx, 348), "for B2B affiliate & MLM networks", font=f_sub, fill=SOFT)

    x = tx
    for t in ["Solidity", "Base L2", "ERC-4337", "SBT"]:
        x += chip(dr, x, 430, t) + 14

    dr.ellipse([tx, 536, tx + 16, 552], fill=EMERALD)
    dr.text((tx + 28, 528), "LIVE", font=font(24), fill=EMERALD)
    dr.text((tx + 96, 526), "web3-binary-matrix-dapp.vercel.app", font=font(28), fill=(226, 232, 240))
    return img


def make_banner():
    W, H = 1280, 400
    img = make_canvas(W, H)
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    dr = ImageDraw.Draw(img)
    draw_tree(dr, 70, 26, 5.6, 8, gd)
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(16)))

    tx = 470
    dr = ImageDraw.Draw(img)
    f_title = fit_font(dr, "BinaryMatrix", 700, 96)
    dr.text((tx, 56), "BinaryMatrix", font=f_title, fill=(255, 255, 255))
    sub = "Web3 binary-matrix dApp — SBT identity · instant splits · 72h holding"
    f_sub = fit_font(dr, sub, 760, 27)
    dr.text((tx, 196), sub, font=f_sub, fill=SOFT)

    x = tx
    for t in ["Solidity", "Base L2", "ERC-4337", "React Flow"]:
        x += chip(dr, x, 262, t, fsz=22) + 13

    dr.ellipse([tx, 344, tx + 14, 358], fill=EMERALD)
    dr.text((tx + 24, 338), "LIVE DEMO", font=font(21), fill=EMERALD)
    dr.text((tx + 160, 336), "web3-binary-matrix-dapp.vercel.app", font=font(24), fill=(226, 232, 240))
    return img


def make_tile(size):
    """Favicon tile: same geometry as icon.svg."""
    img = vertical_gradient(size, size, NAVY_A, NAVY_B).convert("RGBA")
    dr = ImageDraw.Draw(img)
    s = size / 64.0
    nodes = {0: (32, 18, 6.0), 1: (20, 34, 5.0), 2: (44, 34, 5.0),
             3: (14, 50, 4.0), 4: (26, 50, 4.0), 5: (38, 50, 4.0), 6: (50, 50, 4.0)}
    edges = [(0, 1), (0, 2), (1, 3), (1, 4), (2, 5), (2, 6)]

    def P(i):
        x, y, _ = nodes[i]
        return (x * s, y * s)

    for a, b in edges:
        dr.line([P(a), P(b)], fill=LINE + (150,), width=max(1, round(2.6 * s)))
    for i, (x, y, r) in nodes.items():
        col = EMERALD if i == 0 else (INDIGO if i in (1, 2) else VIOLET)
        rr = r * s
        cx, cy = x * s, y * s
        dr.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=col + (255,))
    # rounded-corner mask
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=round(size * 0.22), fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def main():
    os.makedirs(f"{ROOT}/docs", exist_ok=True)

    prev = make_preview()
    prev.convert("RGB").save(f"{ROOT}/docs/social-preview.png", optimize=True)
    prev.save(f"{ROOT}/public/social-preview.png", optimize=True)
    prev.save(f"{ROOT}/download/social-preview.png", optimize=True)

    make_banner().convert("RGB").save(f"{ROOT}/docs/banner.png", optimize=True)

    tile = make_tile(256)
    tile.save(f"{ROOT}/src/app/apple-icon.png")  # Next auto-resizes; keep 256 (>=180)
    tile.resize((180, 180), Image.LANCZOS).save(f"{ROOT}/src/app/apple-icon.png")
    tile.save(f"{ROOT}/src/app/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    tile.save(f"{ROOT}/public/icon-256.png")

    for p in ["docs/social-preview.png", "docs/banner.png", "public/social-preview.png",
              "src/app/apple-icon.png", "src/app/favicon.ico"]:
        fp = f"{ROOT}/{p}"
        print(f"{p}: {os.path.getsize(fp)} bytes")


if __name__ == "__main__":
    main()
