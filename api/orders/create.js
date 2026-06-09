import { paymentEnv, assertPaymentBackend } from '../../scripts/payment-env.mjs';
import { insertOrder, publicOrderView } from '../../scripts/supabase-orders.mjs';

const roundMoney = (n) => Math.round(Number(n) * 100) / 100;

const normalizeItems = (raw) => {
    if (!Array.isArray(raw) || !raw.length) return null;
    return raw
        .map((item) => {
            const qty = Math.max(1, Math.min(99, Number(item.qty) || 1));
            const price = roundMoney(item.price);
            const name = String(item.name || '').trim().slice(0, 200);
            if (!name || price <= 0) return null;
            return {
                id: String(item.id || item.cartKey || '').slice(0, 120),
                cartKey: String(item.cartKey || item.id || '').slice(0, 120),
                name,
                price,
                qty,
                packType: item.packType || null,
            };
        })
        .filter(Boolean);
};

export default async function handler(req, res) {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const origin = host ? `${proto}://${host}` : null;
    const config = paymentEnv(process.env, origin);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const missing = assertPaymentBackend(config);
    if (missing.length) {
        return res.status(503).json({ error: 'Pagamento não configurado', missing });
    }

    try {
        const body = req.body || {};
        const items = normalizeItems(body.items);
        if (!items?.length) {
            return res.status(400).json({ error: 'Carrinho vazio ou inválido' });
        }

        const total = roundMoney(items.reduce((sum, item) => sum + item.price * item.qty, 0));
        if (total < 1) {
            return res.status(400).json({ error: 'Valor mínimo do pedido é R$ 1,00' });
        }

        const deliveryType = body.deliveryType === 'retirada' ? 'retirada' : 'entrega';
        const address = String(body.address || '').trim().slice(0, 500);
        if (deliveryType === 'entrega' && !address) {
            return res.status(400).json({ error: 'Informe o endereço para entrega' });
        }

        const customer = body.customer || {};
        const row = {
            status: 'pending',
            items,
            total,
            delivery_type: deliveryType,
            address: deliveryType === 'entrega' ? address : null,
            notes: String(body.notes || '').trim().slice(0, 1000) || null,
            customer_name: String(customer.name || '').trim().slice(0, 120) || null,
            customer_phone: String(customer.phone || '').trim().slice(0, 32) || null,
            customer_email: String(customer.email || '').trim().slice(0, 120) || null,
        };

        const order = await insertOrder(config.supabaseUrl, config.supabaseServiceKey, row);

        return res.status(201).json({
            orderId: order.id,
            total: Number(order.total),
            order: publicOrderView(order),
        });
    } catch (err) {
        console.error('orders/create', err);
        return res.status(500).json({ error: err.message || 'Erro ao criar pedido' });
    }
}
