/**
 * QR do app Ligeirinho Parceiros (PNG).
 * GET /api/app-qr?download=1  → attachment
 * GET /api/app-qr?size=512
 */
const DEFAULT_ORIGIN = 'https://ligeirinhoparceiros.vercel.app';

function installUrl(req) {
    const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '')
        .split(',')[0]
        .trim();
    const origin =
        host && !/localhost|127\.0\.0\.1/i.test(host)
            ? `${proto}://${host}`
            : DEFAULT_ORIGIN;
    return `${origin.replace(/\/$/, '')}/baixar-app`;
}

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.statusCode = 405;
        res.setHeader('Allow', 'GET, HEAD');
        res.end('Method Not Allowed');
        return;
    }

    const rawSize = Number(req.query?.size);
    const size = Number.isFinite(rawSize) ? Math.min(1024, Math.max(128, Math.round(rawSize))) : 512;
    const target = installUrl(req);
    const qrUrl =
        `https://api.qrserver.com/v1/create-qr-code/` +
        `?size=${size}x${size}&ecc=H&margin=12&color=0D0D0D&bgcolor=FFFFFF` +
        `&data=${encodeURIComponent(target)}`;

    try {
        const upstream = await fetch(qrUrl);
        if (!upstream.ok) {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: 'Falha ao gerar QR code.' }));
            return;
        }
        const buf = Buffer.from(await upstream.arrayBuffer());
        const asDownload = String(req.query?.download || '') === '1';
        res.statusCode = 200;
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
        if (asDownload) {
            res.setHeader(
                'Content-Disposition',
                'attachment; filename="ligeirinho-parceiros-app-qr.png"',
            );
        }
        res.end(buf);
    } catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: err?.message || 'Erro ao gerar QR.' }));
    }
}
