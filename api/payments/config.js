import { paymentEnv, paymentCapabilities } from '../../scripts/payment-env.mjs';

export default function handler(req, res) {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const origin = host ? `${proto}://${host}` : null;
    const config = paymentEnv(process.env, origin);
    const caps = paymentCapabilities(config);
    const channel = String(req.query?.channel || '').toLowerCase();

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (channel === 'totem') {
        return res.status(200).json({
            channel: 'totem',
            methods: {
                pix: caps.pix,
                card: caps.card,
            },
            order: caps.order,
            publicKey: caps.card ? config.mpPublicKey : null,
            enabled: caps.pix || caps.card,
            missing: caps.missing,
        });
    }

    const legacyMissing = caps.missing.card;
    if (!config.mpPublicKey) {
        return res.status(503).json({
            error: 'Pagamento indisponível',
            missing: ['MP_PUBLIC_KEY'],
            capabilities: caps,
        });
    }

    return res.status(200).json({
        publicKey: config.mpPublicKey,
        enabled: legacyMissing.length === 0,
        missing: legacyMissing.length ? legacyMissing : undefined,
        capabilities: caps,
    });
}
