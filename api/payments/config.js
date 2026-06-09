import { paymentEnv, assertPaymentBackend } from '../scripts/payment-env.mjs';

export default function handler(req, res) {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const origin = host ? `${proto}://${host}` : null;
    const config = paymentEnv(process.env, origin);
    const missing = assertPaymentBackend(config).filter((k) => k !== 'MP_ACCESS_TOKEN');

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!config.mpPublicKey) {
        return res.status(503).json({ error: 'Pagamento indisponível', missing: ['MP_PUBLIC_KEY'] });
    }

    return res.status(200).json({
        publicKey: config.mpPublicKey,
        enabled: missing.length === 0,
        missing: missing.length ? missing : undefined,
    });
}
