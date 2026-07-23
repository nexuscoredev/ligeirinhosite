"""Gera ícones PWA com o emblema circular em evidência (sem card/quadrado de fundo)."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
IMG = ROOT / "img"
LOGO = IMG / "ligeirinhologo.png"
OUT_512 = IMG / "app-icon-light-512.png"
OUT_192 = IMG / "app-icon-light-192.png"
OUT_MASK = IMG / "app-icon-light-512-maskable.png"
OUT_LOGO_CLEAR = IMG / "ligeirinhologo.png"

BRAND = (247, 213, 60)  # #F7D53C


def circular_logo(logo: Image.Image) -> Image.Image:
    """Recorta o emblema em círculo e remove o quadrado de fundo."""
    src = logo.convert("RGBA")
    w, h = src.size
    inset = max(1, int(min(w, h) * 0.01))
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).ellipse((inset, inset, w - 1 - inset, h - 1 - inset), fill=255)
    r, g, b, a = src.split()
    src.putalpha(ImageChops.multiply(a, mask))
    return src


def soft_shadow(size: int, diameter: int) -> Image.Image:
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    pad = max(size // 40, 4)
    cx = cy = size // 2
    r = diameter // 2
    draw.ellipse(
        (cx - r + pad, cy - r + pad + 2, cx + r - pad, cy + r - pad + 4),
        fill=(0, 0, 0, 48),
    )
    return shadow.filter(ImageFilter.GaussianBlur(radius=max(size // 48, 3)))


def compose_icon(size: int, logo_scale: float = 0.92) -> Image.Image:
    """Ícone 'any': só o círculo do logo, sem card creme nem wordmark."""
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    logo = circular_logo(Image.open(LOGO))
    logo_d = int(size * logo_scale)
    logo = logo.resize((logo_d, logo_d), Image.Resampling.LANCZOS)
    cx = (size - logo_d) // 2
    cy = (size - logo_d) // 2
    out.alpha_composite(soft_shadow(size, logo_d))
    out.alpha_composite(logo, (cx, cy))
    return out


def compose_maskable(size: int) -> Image.Image:
    """Maskable: fundo da marca + logo circular na safe zone."""
    base = Image.new("RGBA", (size, size), BRAND + (255,))
    logo = circular_logo(Image.open(LOGO))
    logo_d = int(size * 0.72)
    logo = logo.resize((logo_d, logo_d), Image.Resampling.LANCZOS)
    cx = (size - logo_d) // 2
    cy = (size - logo_d) // 2
    base.alpha_composite(logo, (cx, cy))
    return base


def main() -> None:
    if not LOGO.exists():
        raise SystemExit(f"Logo não encontrado: {LOGO}")

    clear = circular_logo(Image.open(LOGO))
    clear.save(OUT_LOGO_CLEAR, format="PNG", optimize=True)

    icon_512 = compose_icon(512)
    icon_512.save(OUT_512, format="PNG", optimize=True)

    icon_192 = icon_512.resize((192, 192), Image.Resampling.LANCZOS)
    icon_192.save(OUT_192, format="PNG", optimize=True)

    maskable = compose_maskable(512)
    maskable.save(OUT_MASK, format="PNG", optimize=True)

    print(f"OK: {OUT_LOGO_CLEAR.name}, {OUT_512.name}, {OUT_192.name}, {OUT_MASK.name}")


if __name__ == "__main__":
    main()
