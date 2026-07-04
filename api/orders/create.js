import { paymentEnv, assertOrderBackend } from '../../scripts/payment-env.mjs';
import {
    insertOrder,
    patchOrder,
    publicOrderView,
    dbFromPaymentConfig,
} from '../../scripts/supabase-orders.mjs';
import { ensureHubPedidoForParceiros } from '../../scripts/hub-parceiro-pedido.mjs';
import {
    upsertCustomer,
    fetchCustomerByHubUserId,
    reserveCredit,
    getFinanceSettings,
} from '../../scripts/supabase-finance.mjs';
import { validatePaymentSplits } from '../../scripts/lib/payment-splits.mjs';
import { formatCpf, isValidCpf, normalizeCpfDigits } from '../../scripts/lib/cpf.mjs';
import { registerTotemCustomer } from '../../scripts/lib/totem-customer-register.mjs';

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
                hubId: String(item.hubId || item.hubProductId || '').trim().slice(0, 36) || null,
                sku: String(item.sku || '').trim().slice(0, 120) || null,
                cartKey: String(item.cartKey || item.id || '').slice(0, 120),
                name,
                price,
                qty,
                packType: item.packType || null,
                categoryId: String(item.categoryId || '').trim().slice(0, 80) || null,
                categoryName: String(item.categoryName || '').trim().slice(0, 120) || null,
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

const normalizePaymentSplits = (raw, total) => {
    if (!Array.isArray(raw) || raw.length < 2) return null;
    const check = validatePaymentSplits(raw, total);
    if (!check.ok) {
        throw new Error(check.error || 'Pagamento dividido inválido.');
    }
    return check.splits;
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
        const deliveryDateRaw = String(body.deliveryDate || '').trim();
        const deliveryDate = /^\d{4}-\d{2}-\d{2}$/.test(deliveryDateRaw) ? deliveryDateRaw : null;
        if (deliveryType === 'entrega' && !address) {
            return res.status(400).json({ error: 'Informe o endereço para entrega' });
        }

        const customer = body.customer || {};
        const customerCpfRaw = customer.cpf || customer.customerCpf || body.customerCpf || '';
        const customerCpfDigits = normalizeCpfDigits(customerCpfRaw);
        if (customerCpfDigits && !isValidCpf(customerCpfDigits)) {
            return res.status(400).json({ error: 'CPF inválido. Confira os dígitos e tente novamente.' });
        }
        const customerCpf = customerCpfDigits.length === 11 ? customerCpfDigits : null;
        const hubUserId = String(body.hubUserId || customer.hubUserId || '').trim() || null;
        const channel = String(body.channel || 'parceiros').trim().slice(0, 32) || 'parceiros';
        const isTotem = channel === 'totem';
        const isParceiros = !isTotem;
        let paymentMethod = String(body.paymentMethod || body.payment || '').toLowerCase().trim();
        let paymentSplits = null;
        try {
            paymentSplits = normalizePaymentSplits(body.paymentSplits || body.payment_splits, total);
        } catch (splitErr) {
            return res.status(400).json({ error: splitErr.message || 'Pagamento dividido inválido.' });
        }
        if (paymentSplits?.length) {
            paymentMethod = paymentSplits.map((item) => item.method).join('+');
        }
        if (!paymentMethod && !isTotem) paymentMethod = 'pix';
        const isCreditOrder = paymentSplits?.length
            ? paymentSplits.some((item) => CREDIT_METHODS.has(item.method))
            : paymentMethod && CREDIT_METHODS.has(paymentMethod);
        const financialStatus =
            isTotem && !paymentMethod
                ? 'pendente'
                : isParceiros
                  ? 'pendente'
                  : isCreditOrder
                    ? 'pendente'
                    : ['pix', 'cartao', 'mercado_pago'].includes(paymentMethod)
                      ? 'em_cobranca'
                      : 'pendente';

        const db = dbFromPaymentConfig(config);

        if (isTotem && String(customer.name || '').trim()) {
            try {
                await registerTotemCustomer(process.env, {
                    name: customer.name,
                    phone: customer.phone,
                    email: customer.email,
                    cpf: customerCpf,
                });
            } catch (regErr) {
                console.warn('orders/create totem customer register', regErr?.message || regErr);
            }
        }

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

        const customerCnpj = String(customer.cnpj || '').trim();
        const notesBase = String(body.notes || '').trim();
        const notesParts = [
            notesBase,
            customerCnpj ? `CNPJ: ${customerCnpj}` : '',
            customerCpf ? `CPF na nota: ${formatCpf(customerCpf)}` : '',
        ].filter(Boolean);
        let notes = notesParts.join(' · ').slice(0, 2000) || null;
        if (paymentSplits?.length) {
            const human = paymentSplits
                .map((item) => `${item.method.toUpperCase()} R$ ${item.amount.toFixed(2).replace('.', ',')}`)
                .join('; ');
            const splitNote = `Pagamento dividido: ${human} [[lig-payment-splits:${JSON.stringify(paymentSplits)}]]`;
            const prefix = notes ? `${notes} · ` : '';
            const combined = `${prefix}${splitNote}`;
            if (combined.length <= 2000) {
                notes = combined;
            } else {
                const maxNotes = Math.max(0, 2000 - splitNote.length - 3);
                notes = `${String(notes || '').slice(0, maxNotes)} · ${splitNote}`;
            }
        }

        const row = {
            status: 'pending',
            items,
            total,
            delivery_type: deliveryType,
            delivery_date: deliveryDate,
            address: deliveryType === 'entrega' ? address : null,
            notes,
            customer_name: String(customer.name || '').trim().slice(0, 120) || null,
            customer_phone: String(customer.phone || '').trim().slice(0, 32) || null,
            customer_email: String(customer.email || '').trim().slice(0, 120) || null,
            customer_cpf: customerCpf,
            channel,
            totem_id: String(body.totemId || '').trim().slice(0, 64) || null,
            totem_label: String(body.totemLabel || '').trim().slice(0, 120) || null,
            unit_id: String(body.unitId || '').trim().slice(0, 64) || null,
            customer_id: customerRow?.id || null,
            hub_user_id: hubUserId,
            payment_method: paymentMethod || null,
            payment_splits: paymentSplits,
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
                    payment_splits: _ps,
                    due_date: _d,
                    financial_status: _e,
                    delivery_date: _f,
                    wants_invoice: _g,
                    nf_queue_status: _h,
                    hub_pedido_id: _i,
                    customer_cpf: _cpf,
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

        let hubPedido = null;
        if (isParceiros) {
            try {
                hubPedido = await ensureHubPedidoForParceiros(order, process.env);
                if (hubPedido?.id && order.hub_pedido_id !== hubPedido.id) {
                    order = await patchOrder(
                        db.url,
                        db.key,
                        order.id,
                        { hub_pedido_id: hubPedido.id },
                        { useRpc: db.useRpc },
                    );
                }
            } catch (hubErr) {
                console.error('orders/create hub sync', hubErr);
            }
            if (!hubPedido) {
                console.warn('orders/create hub sync skipped', {
                    orderId: order.id,
                    hubUserId: order.hub_user_id || null,
                    customerEmail: order.customer_email || null,
                });
            }
        }

        return res.status(201).json({
            orderId: order.id,
            total: Number(order.total),
            order: publicOrderView(order),
            financialStatus: order.financial_status || financialStatus,
            dueDate: order.due_date || row.due_date,
            hubPedidoNumero: hubPedido?.numero ?? null,
            hubPedidoId: hubPedido?.id ?? null,
            hubSyncOk: Boolean(hubPedido?.id),
        });
    } catch (err) {
        console.error('orders/create', err);
        return res.status(500).json({ error: err.message || 'Erro ao criar pedido' });
    }
}
