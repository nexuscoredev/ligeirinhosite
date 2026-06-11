import { paymentEnv, assertPaymentBackend } from '../../scripts/payment-env.mjs';
import { requireFinanceToken } from '../../scripts/finance-auth.mjs';
import { getFinanceSettings, patchFinanceSettings } from '../../scripts/supabase-finance.mjs';

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const auth = requireFinanceToken(req, process.env);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const cfg = paymentEnv(process.env, host ? `${proto}://${host}` : null);
    const missing = assertPaymentBackend(cfg);
    if (missing.length) return res.status(503).json({ error: 'Backend não configurado', missing });

    try {
        if (req.method === 'GET') {
            const settings = await getFinanceSettings(cfg.supabaseUrl, cfg.supabaseServiceKey);
            return res.status(200).json({
                settings: {
                    cashbackPercentDefault: Number(settings?.cashback_percent_default) || 0,
                    defaultDueDays: Number(settings?.default_due_days) || 30,
                    mpConfigured: Boolean(cfg.mpAccessToken && cfg.mpPublicKey),
                    mpPublicKey: cfg.mpPublicKey ? `${cfg.mpPublicKey.slice(0, 8)}…` : null,
                },
            });
        }

        if (req.method === 'PATCH') {
            const body = req.body || {};
            const patch = {};
            if (body.cashbackPercentDefault != null) {
                patch.cashback_percent_default = Math.max(0, Number(body.cashbackPercentDefault));
            }
            if (body.defaultDueDays != null) {
                patch.default_due_days = Math.max(1, Math.floor(Number(body.defaultDueDays)));
            }
            if (cfg.mpPublicKey) patch.mp_public_key = cfg.mpPublicKey;
            const updated = await patchFinanceSettings(cfg.supabaseUrl, cfg.supabaseServiceKey, patch);
            return res.status(200).json({
                settings: {
                    cashbackPercentDefault: Number(updated.cashback_percent_default),
                    defaultDueDays: Number(updated.default_due_days),
                },
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
        console.error('finance/settings', err);
        return res.status(500).json({ error: err.message || 'Erro nas configurações.' });
    }
}
