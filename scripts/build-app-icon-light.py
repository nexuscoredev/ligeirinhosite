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


def draw_parceiros_wordmark(base: Image.Image, size: int, logo_bottom: int) -> None:
    """Somente Parceiros (Caveat), centralizado logo abaixo do emblema."""
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    font_parceiros = load_font(FONT_CAVEAT, max(size // 7, 48))
    text_p = "Parceiros"

    bbox = draw.textbbox((0, 0), text_p, font=font_parceiros)
    w_p = bbox[2] - bbox[0]

    x = (size - w_p) // 2 - bbox[0]
    gap = max(int(size * 0.012), 4)
    y = logo_bottom + gap - bbox[1]

    draw.text((x, y), text_p, fill=PARCEIROS_TEXT + (255,), font=font_parceiros)
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
    cy = (size - logo_d) // 2 - int(size * 0.05)
    base.alpha_composite(shadow, (cx, cy))
    base.alpha_composite(logo, (cx, cy))

    draw_gold_ring(base, size // 2, cy + logo_d // 2, logo_d // 2 + int(size * 0.012))

    if show_wordmark:
        draw_parceiros_wordmark(base, size, cy + logo_d)

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
