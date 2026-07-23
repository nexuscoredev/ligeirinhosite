/**
 * Gera ícones PWA só com o emblema (sem card branco / wordmark).
 * No Windows, PNG transparente vira fundo branco — por isso o ícone "any"
 * preenche 100% do quadrado com o logo (crop circular full-bleed).
 *
 * Uso: node scripts/build-app-icon-circle.mjs
 */
import sharp from 'sharp';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const img = join(root, 'img');
const logoPath = join(img, 'ligeirinhologo.png');
const out512 = join(img, 'app-icon-light-512.png');
const out192 = join(img, 'app-icon-light-192.png');
const outMask = join(img, 'app-icon-light-512-maskable.png');

const BRAND = { r: 247, g: 213, b: 60, alpha: 1 };

async function circularize(inputBuffer, size) {
    const resized = await sharp(inputBuffer)
        .resize(size, size, { fit: 'cover' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const { data, info } = resized;
    const cx = (info.width - 1) / 2;
    const cy = (info.height - 1) / 2;
    const radius = Math.min(cx, cy) - 0.5;

    for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
            const i = (y * info.width + x) * 4;
            const dx = x - cx;
            const dy = y - cy;
            if (dx * dx + dy * dy > radius * radius) {
                data[i + 3] = 0;
            }
        }
    }

    return sharp(data, {
        raw: { width: info.width, height: info.height, channels: 4 },
    })
        .png()
        .toBuffer();
}

/**
 * Ícone de atalho (Windows/Chrome): emblema cobrindo o quadrado, sem transparência
 * nas bordas (o Windows pinta PNG transparente de branco = “card” feio).
 */
async function composeAny(size, coverScale = 1.55) {
    const src = readFileSync(logoPath);
    const logoD = Math.round(size * coverScale);
    const logo = await circularize(src, logoD);
    const flattened = await sharp({
        create: {
            width: logoD,
            height: logoD,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 1 },
        },
    })
        .composite([{ input: logo, left: 0, top: 0 }])
        .png()
        .toBuffer();

    const inset = Math.max(0, Math.round((logoD - size) / 2));
    return sharp(flattened)
        .extract({ left: inset, top: inset, width: size, height: size })
        .png()
        .toBuffer();
}

async function composeMaskable(size) {
    const src = readFileSync(logoPath);
    const logoD = Math.round(size * 0.78);
    const logo = await circularize(src, logoD);
    const left = Math.round((size - logoD) / 2);
    const top = Math.round((size - logoD) / 2);

    return sharp({
        create: {
            width: size,
            height: size,
            channels: 4,
            background: BRAND,
        },
    })
        .composite([{ input: logo, left, top }])
        .png()
        .toBuffer();
}

const clearLogo = await circularize(readFileSync(logoPath), 512);
writeFileSync(logoPath, clearLogo);

const icon512 = await composeAny(512);
const icon192 = await sharp(icon512).resize(192, 192).png().toBuffer();
const maskable = await composeMaskable(512);

writeFileSync(out512, icon512);
writeFileSync(out192, icon192);
writeFileSync(outMask, maskable);

console.log('OK: emblema full-bleed (sem card branco) + maskable');
