import { paymentEnv } from '../../scripts/payment-env.mjs';
import { DEFAULT_VAPID_PUBLIC_KEY, vapidConfig } from '../../scripts/web-push.mjs';

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const origin = host ? `${proto}://${host}` : null;
    paymentEnv(process.env, origin);

    const { publicKey } = vapidConfig(process.env);
    return res.status(200).json({
        publicKey: publicKey || DEFAULT_VAPID_PUBLIC_KEY,
    });
}
