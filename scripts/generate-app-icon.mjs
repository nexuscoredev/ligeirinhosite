import sharp from 'sharp';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const logoPath = join(root, 'img', 'ligeirinhologo.png');
const out192 = join(root, 'img', 'app-icon-192.png');
const out512 = join(root, 'img', 'app-icon-512.png');
const outMaskable = join(root, 'img', 'app-icon-512-maskable.png');

const buildBackground = (size, radiusRatio = 0.215) => {
    const radius = Math.round(size * radiusRatio);
    return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F9E08A"/>
      <stop offset="45%" stop-color="#F7D53C"/>
      <stop offset="100%" stop-color="#C9A82A"/>
    </linearGradient>
    <radialGradient id="shine" cx="28%" cy="22%" r="55%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.28)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#bg)"/>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#shine)"/>
</svg>`);
};

const buildBadge = (size) => {
    const w = Math.round(size * 0.3);
    const h = Math.round(size * 0.1);
    return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" rx="${h / 2}" fill="#ffffff" fill-opacity="0.96"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
    font-family="Segoe UI, Helvetica Neue, Arial, sans-serif" font-size="${Math.round(h * 0.48)}"
    font-weight="800" letter-spacing="0.14em" fill="#F7D53C">APP</text>
</svg>`);
};

async function renderIcon(size, { maskable = false } = {}) {
    const logoScale = maskable ? 0.5 : 0.62;
    const circleScale = maskable ? 0.56 : 0.72;
    const lift = maskable ? 0 : size * 0.035;

    const logoSize = Math.round(size * logoScale);
    const circleSize = Math.round(size * circleScale);

    const bg = await sharp(buildBackground(size)).png().toBuffer();

    const circleSvg = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${circleSize}" height="${circleSize}">
  <circle cx="${circleSize / 2}" cy="${circleSize / 2}" r="${circleSize / 2}" fill="#ffffff"/>
</svg>`
    );
    const circle = await sharp(circleSvg).png().toBuffer();

    const logo = await sharp(logoPath)
        .resize(logoSize, logoSize, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 0 },
        })
        .png()
        .toBuffer();

    const circleLeft = Math.round((size - circleSize) / 2);
    const circleTop = Math.round((size - circleSize) / 2 - lift);
    const logoLeft = Math.round((size - logoSize) / 2);
    const logoTop = Math.round((size - logoSize) / 2 - lift);

    const layers = [
        { input: circle, left: circleLeft, top: circleTop },
        { input: logo, left: logoLeft, top: logoTop },
    ];

    if (!maskable) {
        const badge = await sharp(buildBadge(size)).png().toBuffer();
        const badgeMeta = await sharp(badge).metadata();
        layers.push({
            input: badge,
            left: Math.round((size - badgeMeta.width) / 2),
            top: Math.round(size * 0.84 - badgeMeta.height / 2),
        });
    }

    return sharp(bg).composite(layers).png().toBuffer();
}

const icon512 = await renderIcon(512);
const icon192 = await sharp(icon512).resize(192, 192).png().toBuffer();
const iconMaskable = await renderIcon(512, { maskable: true });

await sharp(icon512).toFile(out512);
await sharp(icon192).toFile(out192);
await sharp(iconMaskable).toFile(outMaskable);

console.log('Generated:', out192, out512, outMaskable);
