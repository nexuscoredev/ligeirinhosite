import { paymentEnv, assertOrderBackend } from '../../scripts/payment-env.mjs';
import { fetchOrderById, publicOrderView, dbFromPaymentConfig } from '../../scripts/supabase-orders.mjs';
import {
    fetchHubPedidoById,
    fetchHubPedidoByParceirosOrderId,
    buildOrderTracking,
} from '../../scripts/hub-order-tracking.mjs';
import { requireAccountSession } from '../account/_require-hub-session.mjs';
import { collectParceiroOrderLookup } from '../../scripts/hub-parceiro.mjs';
import { resolveAccountCnpj } from '../../scripts/lib/order-edit-policy.mjs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const origin = host ? `${proto}://${host}` : null;
    const config = paymentEnv(process.env, origin);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const id = String(req.query.id || '').trim();
    if (!UUID_RE.test(id)) {
        return res.status(400).json({ error: 'ID de pedido inválido' });
    }

    const missing = assertOrderBackend(config);
    if (missing.length) {
        return res.status(503).json({ error: 'Backend indisponível', missing });
    }

    try {
        const db = dbFromPaymentConfig(config);
        const order = await fetchOrderById(db.url, db.key, id, { useRpc: db.useRpc });
        if (!order) {
            return res.status(404).json({ error: 'Pedido não encontrado' });
        }
        const view = publicOrderView(order);
        let hubPedido = null;
        if (view.hubPedidoId) {
            hubPedido = await fetchHubPedidoById(view.hubPedidoId, process.env);
        }
        if (!hubPedido) {
            hubPedido = await fetchHubPedidoByParceirosOrderId(view.id, process.env);
        }

        let accountCnpj = '';
        try {
            const session = await requireAccountSession(req);
            if (!session.error) {
                const authEmail = String(
                    session.authUser?.email || session.usuario?.email || req.headers['x-account-email'] || '',
                ).trim();
                const lookup = await collectParceiroOrderLookup(session.config, session.usuario, {
                    email: authEmail,
                    sub: String(req.headers['x-auth-sub'] || req.query.sub || session.userId || '').trim(),
                });
                accountCnpj = resolveAccountCnpj(lookup.cnpjDigits || session.usuario, view);
            }
        } catch {
            /* tracking público sem sessão */
        }

        const tracking = buildOrderTracking(view, hubPedido, { accountCnpj });
        return res.status(200).json({ order: view, tracking });
    } catch (err) {
        console.error('orders/get', err);
        return res.status(500).json({ error: 'Erro ao buscar pedido' });
    }
}
