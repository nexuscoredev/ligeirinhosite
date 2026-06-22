import { paymentEnv, assertOrderBackend } from '../../scripts/payment-env.mjs';
import { insertOrder, publicOrderView, dbFromPaymentConfig } from '../../scripts/supabase-orders.mjs';
import {
    upsertCustomer,
    fetchCustomerByHubUserId,
    reserveCredit,
    getFinanceSettings,
} from '../../scripts/supabase-finance.mjs';

export const config = { maxDuration: 15 };

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

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

const CREDIT_METHODS = new Set(['fiado', 'credito', 'boleto', 'prazo']);

export default async function handler(req, res) {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const origin = host ? `${proto}://${host}` : null;
    const config = paymentEnv(process.env, origin);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const missing = assertOrderBackend(config);
    if (missing.length) {
        return res.status(503).json({ error: 'Pedidos não configurados', missing });
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
        const hubUserId = String(body.hubUserId || customer.hubUserId || '').trim() || null;
        const channel = String(body.channel || 'parceiros').trim().slice(0, 32) || 'parceiros';
        const isTotem = channel === 'totem';
        let paymentMethod = String(body.paymentMethod || body.payment || '').toLowerCase().trim();
        if (!paymentMethod && !isTotem) paymentMethod = 'pix';
        const isCreditOrder = paymentMethod && CREDIT_METHODS.has(paymentMethod);

        const db = dbFromPaymentConfig(config);

        let customerRow = null;
        let settings = null;
        try {
            settings = await getFinanceSettings(config.supabaseUrl, config.supabaseServiceKey);
        } catch {
            /* finance tables may not exist yet */
        }

        if (hubUserId || customer.email || customer.phone) {
            try {
                customerRow =
                    (hubUserId &&
                        (await fetchCustomerByHubUserId(
                            config.supabaseUrl,
                            config.supabaseServiceKey,
                            hubUserId
                        ))) ||
                    null;
                if (!customerRow && (hubUserId || customer.name)) {
                    customerRow = await upsertCustomer(config.supabaseUrl, config.supabaseServiceKey, {
                        hub_user_id: hubUserId,
                        name: String(customer.name || 'Cliente').slice(0, 120),
                        email: String(customer.email || '').slice(0, 120) || null,
                        phone: String(customer.phone || '').slice(0, 32) || null,
                    });
                }
                if (customerRow && isCreditOrder) {
                    await reserveCredit(config.supabaseUrl, config.supabaseServiceKey, customerRow.id, total);
                }
            } catch (creditErr) {
                if (isCreditOrder) {
                    return res.status(402).json({ error: creditErr.message || 'Limite de crédito excedido.' });
                }
            }
        }

        const dueDays = Number(settings?.default_due_days) || 30;
        const financialStatus =
            isTotem && !paymentMethod
                ? 'pendente'
                : isCreditOrder
                  ? 'pendente'
                  : paymentMethod === 'mercado_pago'
                    ? 'em_cobranca'
                    : 'pendente';

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
            channel,
            totem_id: String(body.totemId || '').trim().slice(0, 64) || null,
            totem_label: String(body.totemLabel || '').trim().slice(0, 120) || null,
            unit_id: String(body.unitId || '').trim().slice(0, 64) || null,
            customer_id: customerRow?.id || null,
            hub_user_id: hubUserId,
            payment_method: paymentMethod || null,
            due_date: isCreditOrder || financialStatus === 'pendente' ? addDays(new Date(), dueDays) : null,
            financial_status: financialStatus,
        };

        let order;
        try {
            order = await insertOrder(db.url, db.key, row, { useRpc: db.useRpc });
        } catch (insertErr) {
            const msg = String(insertErr.message || '');
            if (/column/i.test(msg)) {
                const {
                    customer_id: _a,
                    hub_user_id: _b,
                    payment_method: _c,
                    due_date: _d,
                    financial_status: _e,
                    ...legacyRow
                } = row;
                if (channel === 'totem') {
                    const { channel: _f, totem_id: _g, totem_label: _h, unit_id: _i, ...minimal } = legacyRow;
                    order = await insertOrder(db.url, db.key, minimal, { useRpc: db.useRpc });
                } else {
                    order = await insertOrder(db.url, db.key, legacyRow, { useRpc: db.useRpc });
                }
            } else if (channel === 'totem' && /column/i.test(msg)) {
                const { channel: _c, totem_id: _t, totem_label: _l, unit_id: _u, ...legacyRow } = row;
                order = await insertOrder(db.url, db.key, legacyRow, { useRpc: db.useRpc });
            } else {
                throw insertErr;
            }
        }

        return res.status(201).json({
            orderId: order.id,
            total: Number(order.total),
            order: publicOrderView(order),
            financialStatus: order.financial_status || financialStatus,
            dueDate: order.due_date || row.due_date,
        });
    } catch (err) {
        console.error('orders/create', err);
        return res.status(500).json({ error: err.message || 'Erro ao criar pedido' });
    }
}
