import { paymentEnv, assertPaymentBackend } from '../../scripts/payment-env.mjs';
import { requireFinanceToken } from '../../scripts/finance-auth.mjs';
import {
    fetchCustomerById,
    customerFinanceHistory,
    patchCustomer,
    listCustomers,
    customerView,
    getOrCreateWallet,
    walletTransaction,
    orderFinanceView,
    chargeView,
} from '../../scripts/supabase-finance.mjs';
import { fetchOrderById } from '../../scripts/supabase-orders.mjs';

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

    const customerId = req.query.id || req.body?.customerId;

    try {
        if (req.method === 'GET') {
            if (customerId) {
                const history = await customerFinanceHistory(cfg.supabaseUrl, cfg.supabaseServiceKey, customerId);
                if (!history.customer) return res.status(404).json({ error: 'Cliente não encontrado' });
                return res.status(200).json({
                    customer: customerView(history.customer),
                    orders: (history.orders || []).map(orderFinanceView),
                    charges: (history.charges || []).map(chargeView),
                    wallet: history.wallet
                        ? { balance: Number(history.wallet.balance), id: history.wallet.id }
                        : null,
                    walletTransactions: history.walletTransactions || [],
                });
            }
            const customers = await listCustomers(cfg.supabaseUrl, cfg.supabaseServiceKey, {
                limit: Number(req.query.limit) || 50,
                offset: Number(req.query.offset) || 0,
            });
            return res.status(200).json({ customers: (customers || []).map(customerView) });
        }

        if (req.method === 'PATCH' && customerId) {
            const body = req.body || {};
            const patch = {};
            if (body.creditLimit != null) patch.credit_limit = Math.max(0, Number(body.creditLimit));
            if (body.isBlocked != null) patch.is_blocked = Boolean(body.isBlocked);
            if (body.notes != null) patch.notes = String(body.notes).slice(0, 2000);
            if (body.creditUsed != null) patch.credit_used = Math.max(0, Number(body.creditUsed));
            const updated = await patchCustomer(cfg.supabaseUrl, cfg.supabaseServiceKey, customerId, patch);
            return res.status(200).json({ customer: customerView(updated) });
        }

        if (req.method === 'POST' && req.body?.action === 'wallet-adjust' && customerId) {
            const amount = Number(req.body.amount);
            const description = String(req.body.description || 'Ajuste manual').slice(0, 500);
            if (!amount) return res.status(400).json({ error: 'Informe o valor do ajuste.' });
            const customer = await fetchCustomerById(cfg.supabaseUrl, cfg.supabaseServiceKey, customerId);
            if (!customer) return res.status(404).json({ error: 'Cliente não encontrado' });
            const wallet = await getOrCreateWallet(
                cfg.supabaseUrl,
                cfg.supabaseServiceKey,
                customerId,
                customer.hub_user_id
            );
            const result = await walletTransaction(cfg.supabaseUrl, cfg.supabaseServiceKey, {
                walletId: wallet.id,
                type: 'ajuste',
                amount,
                description,
                createdBy: auth.user.login || auth.user.name,
            });
            return res.status(200).json({ balance: result.balance });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
        console.error('finance/customers', err);
        return res.status(500).json({ error: err.message || 'Erro ao processar cliente.' });
    }
}
