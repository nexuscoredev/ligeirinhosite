import { paymentEnv, assertPaymentBackend } from '../../scripts/payment-env.mjs';
import { requireFinanceToken } from '../../scripts/finance-auth.mjs';
import { financeDashboardStats, listOrdersFinance, listCharges, orderFinanceView, chargeView } from '../../scripts/supabase-finance.mjs';

export const config = { maxDuration: 20 };

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
            const view = req.query.view || 'dashboard';
            if (view === 'orders') {
                const orders = await listOrdersFinance(cfg.supabaseUrl, cfg.supabaseServiceKey, {
                    financialStatus: req.query.status || undefined,
                    customerId: req.query.customerId || undefined,
                    limit: Number(req.query.limit) || 100,
                    offset: Number(req.query.offset) || 0,
                });
                return res.status(200).json({
                    orders: (orders || []).map(orderFinanceView),
                });
            }
            if (view === 'charges') {
                const charges = await listCharges(cfg.supabaseUrl, cfg.supabaseServiceKey, {
                    limit: Number(req.query.limit) || 50,
                });
                return res.status(200).json({
                    charges: (charges || []).map(chargeView),
                });
            }
            const stats = await financeDashboardStats(cfg.supabaseUrl, cfg.supabaseServiceKey);
            return res.status(200).json({ stats });
        }
        return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
        console.error('finance/dashboard', err);
        return res.status(500).json({ error: err.message || 'Erro no painel financeiro.' });
    }
}
