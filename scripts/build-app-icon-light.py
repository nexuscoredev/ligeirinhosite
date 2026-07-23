"""Gera ícones PWA light (Parceiros) a partir do logo circular existente."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
IMG = ROOT / "img"
FONTS = ROOT / "scripts" / "fonts"
LOGO = IMG / "ligeirinhologo.png"
FONT_JAKARTA = FONTS / "PlusJakartaSans-ExtraBold.ttf"
FONT_CAVEAT = FONTS / "Caveat-Bold.ttf"
OUT_512 = IMG / "app-icon-light-512.png"
OUT_192 = IMG / "app-icon-light-192.png"
OUT_MASK = IMG / "app-icon-light-512-maskable.png"

BRAND = (247, 213, 60)  # #F7D53C — Ligeirinho no anexo
LIGEIRINHO_TEXT = (166, 124, 0)  # #A67C00 — legível no fundo claro (site.css)
PARCEIROS_TEXT = (0, 0, 0)  # script escura no light (site.css .lig-brand__app)
WHITE = (255, 255, 255)
CREAM = (255, 252, 245)


def rounded_rect_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def make_background(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), CREAM + (255,))
    draw = ImageDraw.Draw(img)
    cx = cy = size // 2
    for r in range(size // 2, 0, -1):
        t = r / (size / 2)
        color = (
            int(WHITE[0] * (1 - t * 0.08) + CREAM[0] * t * 0.08),
            int(WHITE[1] * (1 - t * 0.08) + CREAM[1] * t * 0.08),
            int(WHITE[2] * (1 - t * 0.08) + CREAM[2] * t * 0.08),
            255,
        )
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=color)
    return img


def load_font(path: Path, size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    if path.exists():
        return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def draw_gold_ring(base: Image.Image, cx: int, cy: int, radius: int, width: int = 4) -> None:
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for i in range(width):
        r = radius - i
        alpha = 180 - i * 25
        draw.ellipse(
            (cx - r, cy - r, cx + r, cy + r),
            outline=BRAND + (max(alpha, 80),),
            width=1,
        )
    base.alpha_composite(overlay)


def render_rotated_text(text: str, font: ImageFont.FreeTypeFont, fill: tuple[int, int, int, int], angle: float) -> Image.Image:
    bbox = font.getbbox(text)
    pad = 8
    w = bbox[2] - bbox[0] + pad * 2
    h = bbox[3] - bbox[1] + pad * 2
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.text((pad - bbox[0], pad - bbox[1]), text, fill=fill, font=font)
    return layer.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)


def draw_parceiros_wordmark(base: Image.Image, size: int) -> None:
    """Wordmark igual ao anexo / site: Ligeirinho (sans amarelo) + Parceiros (Caveat)."""
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    font_ligeirinho = load_font(FONT_JAKARTA, max(size // 17, 24))
    font_parceiros = load_font(FONT_CAVEAT, max(size // 13, 30))

    text_l = "Ligeirinho"
    text_p = "Parceiros"

    bbox_l = draw.textbbox((0, 0), text_l, font=font_ligeirinho)
    w_l = bbox_l[2] - bbox_l[0]
    h_l = bbox_l[3] - bbox_l[1]

    parceiros_layer = render_rotated_text(text_p, font_parceiros, PARCEIROS_TEXT + (255,), -2.5)
    w_p, h_p = parceiros_layer.size

    gap = max(size // 70, 3)
    total_w = w_l + gap + w_p
    x = (size - total_w) // 2
    y = size - int(size * 0.105) - h_l

    # Ligeirinho — amarelo brand (#F7D53C) como no anexo
    draw.text((x, y), text_l, fill=BRAND + (255,), font=font_ligeirinho)

    px = x + w_l + gap
    py = y + int(h_l * 0.12)
    overlay.alpha_composite(parceiros_layer, (px, py))
    base.alpha_composite(overlay)


def compose_icon(size: int, logo_scale: float, show_wordmark: bool = True) -> Image.Image:
    base = make_background(size)
    logo = Image.open(LOGO).convert("RGBA")

    logo_d = int(size * logo_scale)
    logo = logo.resize((logo_d, logo_d), Image.Resampling.LANCZOS)

    shadow = Image.new("RGBA", (logo_d, logo_d), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.ellipse((8, 10, logo_d - 8, logo_d - 6), fill=(0, 0, 0, 35))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=max(size // 64, 4)))

    cx = (size - logo_d) // 2
    cy = (size - logo_d) // 2 - int(size * 0.045)
    base.alpha_composite(shadow, (cx, cy))
    base.alpha_composite(logo, (cx, cy))

    draw_gold_ring(base, size // 2, cy + logo_d // 2, logo_d // 2 + int(size * 0.012))

    if show_wordmark:
        draw_parceiros_wordmark(base, size)

    radius = int(size * 0.2237)
    mask = rounded_rect_mask(size, radius)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(base, (0, 0), mask)
    return out


def compose_maskable(size: int) -> Image.Image:
    base = Image.new("RGBA", (size, size), BRAND + (255,))
    logo = Image.open(LOGO).convert("RGBA")
    logo_d = int(size * 0.58)
    logo = logo.resize((logo_d, logo_d), Image.Resampling.LANCZOS)
    cx = (size - logo_d) // 2
    cy = (size - logo_d) // 2
    base.alpha_composite(logo, (cx, cy))
    return base


def main() -> None:
    if not LOGO.exists():
        raise SystemExit(f"Logo não encontrado: {LOGO}")
    if not FONT_JAKARTA.exists() or not FONT_CAVEAT.exists():
        raise SystemExit("Fontes em scripts/fonts/ ausentes. Rode o download de Caveat e Plus Jakarta Sans.")

    icon_512 = compose_icon(512, logo_scale=0.64)
    icon_512.save(OUT_512, format="PNG", optimize=True)

    icon_192 = icon_512.resize((192, 192), Image.Resampling.LANCZOS)
    icon_192.save(OUT_192, format="PNG", optimize=True)

    maskable = compose_maskable(512)
    maskable.save(OUT_MASK, format="PNG", optimize=True)

    print(f"OK: {OUT_512.name}, {OUT_192.name}, {OUT_MASK.name}")


if __name__ == "__main__":
    main()
