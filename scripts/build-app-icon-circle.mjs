/**
 * Gera ícones PWA do emblema circular.
 *
 * - purpose "any": círculo com transparência (atalho no Windows/PC
 *   sem card preto/branco — no desktop escuro fica como o Hub).
 * - purpose "maskable": emblema centrado em fundo amarelo da marca.
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
const outIco = join(root, 'favicon.ico');

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
                data[i] = 0;
                data[i + 1] = 0;
                data[i + 2] = 0;
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

/** Atalho PC: só o emblema circular, fundo transparente. */
async function composeAny(size) {
    const src = readFileSync(logoPath);
    return circularize(src, size);
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

/** ICO multi-tamanho para Windows (favicon / atalho). */
async function writeIco(png512) {
    const sizes = [16, 32, 48, 64, 128, 256];
    const images = [];
    for (const size of sizes) {
        const png = await sharp(png512).resize(size, size).png().toBuffer();
        images.push({ size, png });
    }

    const headerSize = 6;
    const entrySize = 16;
    const offset0 = headerSize + entrySize * images.length;
    let offset = offset0;
    const entries = [];
    const blobs = [];

    for (const { size, png } of images) {
        entries.push({ size, offset, bytes: png.length });
        blobs.push(png);
        offset += png.length;
    }

    const buf = Buffer.alloc(offset);
    buf.writeUInt16LE(0, 0);
    buf.writeUInt16LE(1, 2);
    buf.writeUInt16LE(images.length, 4);

    entries.forEach((e, i) => {
        const o = headerSize + i * entrySize;
        buf.writeUInt8(e.size >= 256 ? 0 : e.size, o);
        buf.writeUInt8(e.size >= 256 ? 0 : e.size, o + 1);
        buf.writeUInt8(0, o + 2);
        buf.writeUInt8(0, o + 3);
        buf.writeUInt16LE(1, o + 4);
        buf.writeUInt16LE(32, o + 6);
        buf.writeUInt32LE(e.bytes, o + 8);
        buf.writeUInt32LE(e.offset, o + 12);
    });

    let cursor = offset0;
    for (const png of blobs) {
        png.copy(buf, cursor);
        cursor += png.length;
    }

    writeFileSync(outIco, buf);
}

const clearLogo = await circularize(readFileSync(logoPath), 512);
writeFileSync(logoPath, clearLogo);

const icon512 = await composeAny(512);
const icon192 = await sharp(icon512).resize(192, 192).png().toBuffer();
const maskable = await composeMaskable(512);

writeFileSync(out512, icon512);
writeFileSync(out192, icon192);
writeFileSync(outMask, maskable);
await writeIco(icon512);

console.log('OK: emblema circular transparente + maskable + favicon.ico');
