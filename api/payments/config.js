import { paymentEnv, paymentCapabilities } from '../../scripts/payment-env.mjs';

export default function handler(req, res) {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const origin = host ? `${proto}://${host}` : null;
    const config = paymentEnv(process.env, origin);
    const caps = paymentCapabilities(config, process.env);
    const channel = String(req.query?.channel || '').toLowerCase();
    const webhookMp = config.appBaseUrl ? `${config.appBaseUrl}/api/payments/webhook` : null;
    const webhookSantander = config.appBaseUrl
        ? `${config.appBaseUrl}/api/payments/webhook-santander`
        : null;

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
            pixProvider: caps.pixProvider,
            publicKey: caps.card ? config.mpPublicKey : null,
            enabled: caps.pix || caps.card,
            missing: caps.missing,
            webhookUrl: caps.pixProvider === 'santander' ? webhookSantander : webhookMp,
        });
    }

    const onlineEnabled = caps.pix || caps.card;
    if (!onlineEnabled) {
        return res.status(503).json({
            error: 'Pagamento indisponível',
            missing: [...caps.missing.pix, ...caps.missing.card],
            webhookUrl: webhookMp,
            webhookSantanderUrl: webhookSantander,
            capabilities: caps,
        });
    }

    return res.status(200).json({
        publicKey: caps.card ? config.mpPublicKey : null,
        enabled: onlineEnabled,
        pixProvider: caps.pixProvider,
        mercadoPagoReady: caps.card,
        santanderPixReady: caps.pix && caps.pixProvider === 'santander',
        webhookUrl: webhookMp,
        webhookSantanderUrl: webhookSantander,
        missing: {
            pix: caps.missing.pix.length ? caps.missing.pix : undefined,
            card: caps.missing.card.length ? caps.missing.card : undefined,
        },
        capabilities: caps,
    });
}
