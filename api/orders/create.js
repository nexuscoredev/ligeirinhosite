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
import { resolveParceirosDeliveryFee, prependDeliveryFeeToItems, isDeliveryFeeLineItem, parseTaxaEntrega } from '../../scripts/lib/delivery-fee.mjs';
import { isDistribuidoraAccount } from '../../scripts/lib/distribuidora-account.mjs';
import { formatCpf, formatClienteDocDigits, isValidCpf, normalizeCpfDigits } from '../../scripts/lib/cpf.mjs';
import { formatCnpj, isValidCnpj, normalizeDocDigits } from '../../scripts/hub-parceiro.mjs';
import { sanitizeCustomerPhone } from '../../scripts/lib/customer-phone.mjs';
import { registerTotemCustomer } from '../../scripts/lib/totem-customer-register.mjs';
import {
    syncDistribuidoraClienteFinal,
    orderUsesCreditPayment,
} from '../../scripts/lib/distribuidora-cliente-final.mjs';

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
                promoId: String(item.promoId || '').trim().slice(0, 64) || null,
                isPromo: Boolean(item.promoId || item.isPromo),
                originalPrice:
                    item.originalPrice != null && Number.isFinite(Number(item.originalPrice))
                        ? roundMoney(item.originalPrice)
                        : null,
                discountPct:
                    item.discountPct != null && Number.isFinite(Number(item.discountPct))
                        ? Math.max(0, Math.round(Number(item.discountPct)))
                        : null,
            };
        })
        .filter(Boolean)
        .filter((item) => !isDeliveryFeeLineItem(item));
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

        const subtotal = roundMoney(items.reduce((sum, item) => sum + item.price * item.qty, 0));
        if (subtotal < 1) {
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
        const orderClienteDocRaw = String(body.orderClienteDoc || customer.doc || '').trim();
        const orderClienteDocDigits = normalizeDocDigits(orderClienteDocRaw).slice(0, 14);
        let orderClienteDocFormatted = '';
        if (orderClienteDocDigits) {
            if (orderClienteDocDigits.length === 11) {
                if (!isValidCpf(orderClienteDocDigits)) {
                    return res.status(400).json({ error: 'CPF do cliente inválido. Confira os dígitos.' });
                }
                orderClienteDocFormatted = formatClienteDocDigits(orderClienteDocDigits);
            } else if (orderClienteDocDigits.length === 14) {
                if (!isValidCnpj(orderClienteDocDigits)) {
                    return res.status(400).json({ error: 'CNPJ do cliente inválido. Confira os dígitos.' });
                }
                orderClienteDocFormatted = formatCnpj(orderClienteDocDigits);
            } else {
                return res.status(400).json({ error: 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.' });
            }
        }

        const customerCpfRaw =
            customer.cpf ||
            customer.customerCpf ||
            body.customerCpf ||
            (orderClienteDocDigits.length === 11 ? orderClienteDocDigits : '') ||
            '';
        const customerCpfDigits = normalizeCpfDigits(customerCpfRaw);
        if (customerCpfDigits && !isValidCpf(customerCpfDigits)) {
            return res.status(400).json({ error: 'CPF inválido. Confira os dígitos e tente novamente.' });
        }
        const customerCpf = customerCpfDigits.length === 11 ? customerCpfDigits : null;
        const hubUserId = String(body.hubUserId || customer.hubUserId || '').trim() || null;
        const channel = String(body.channel || 'parceiros').trim().slice(0, 32) || 'parceiros';
        const isTotem = channel === 'totem';
        const isParceiros = !isTotem;
        const customerCnpj = String(customer.cnpj || body.customerCnpj || '').trim();
        const orderClienteAPrazo =
            body.orderClienteAPrazo === true || String(body.orderClienteAPrazo || '').toLowerCase() === 'true';

        const deliveryFee = (() => {
            const orderTaxaRaw = body.orderTaxaEntrega;
            const hasOrderTaxa =
                orderTaxaRaw !== undefined && orderTaxaRaw !== null && orderTaxaRaw !== '';
            if (isDistribuidoraAccount(customerCnpj) && hasOrderTaxa) {
                const parsed = parseTaxaEntrega(orderTaxaRaw);
                if (parsed != null) return parsed;
            }
            return null;
        })();

        const resolvedDeliveryFee =
            deliveryFee != null
                ? deliveryFee
                : await resolveParceirosDeliveryFee(process.env, {
                      channel,
                      deliveryType,
                      hubUserId,
                  });
        const orderItems = prependDeliveryFeeToItems(items, resolvedDeliveryFee);
        const total = roundMoney(orderItems.reduce((sum, item) => sum + item.price * item.qty, 0));
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
        if (
            isDistribuidoraAccount(customerCnpj) &&
            orderUsesCreditPayment(paymentMethod, paymentSplits) &&
            !orderClienteAPrazo
        ) {
            return res.status(400).json({
                error: 'Marque "Cliente a prazo" para usar pagamento a prazo/crediário.',
            });
        }
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
                    phone: sanitizeCustomerPhone(customer.phone, {
                        cpf: customerCpf || customer.cpf,
                        cnpj: customer.cnpj,
                    }),
                    email: customer.email,
                    cpf: customerCpf || customer.cpf,
                    cnpj: customer.cnpj,
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

        const customerPhone = sanitizeCustomerPhone(customer.phone, {
            cpf: customerCpf,
            cnpj: customerCnpj,
        });
        const notesBase = String(body.notes || '').trim();
        const notesParts = [
            notesBase,
            customerCnpj ? `CNPJ: ${customerCnpj}` : '',
            customerCpf ? `CPF na nota: ${formatCpf(customerCpf)}` : '',
        ].filter(Boolean);
        const orderTabelaPrecoId = String(body.orderTabelaPrecoId || '').trim();
        const orderTabelaPrecoCodigo = String(body.orderTabelaPrecoCodigo || '').trim();
        const orderClienteNome = String(body.orderClienteNome || '').trim().slice(0, 120);
        if (orderTabelaPrecoCodigo) {
            notesParts.push(`Tabela: ${orderTabelaPrecoCodigo}`);
        }
        if (orderClienteNome) {
            notesParts.push(`Cliente: ${orderClienteNome}`);
        }
        if (orderClienteDocFormatted) {
            notesParts.push(`Doc cliente: ${orderClienteDocFormatted}`);
        }
        if (isDistribuidoraAccount(customerCnpj)) {
            notesParts.push(orderClienteAPrazo ? 'Cliente a prazo: sim' : 'Cliente a prazo: não');
        }
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
            items: orderItems,
            total,
            delivery_type: deliveryType,
            delivery_date: deliveryDate,
            address: deliveryType === 'entrega' ? address : null,
            notes,
            customer_name: orderClienteNome || String(customer.name || '').trim().slice(0, 120) || null,
            customer_phone: customerPhone ? customerPhone.slice(0, 32) : null,
            customer_email: String(customer.email || '').trim().slice(0, 120) || null,
            customer_cpf: customerCpf,
            channel,
            totem_id: String(body.totemId || '').trim().slice(0, 64) || null,
            totem_label: String(body.totemLabel || '').trim().slice(0, 120) || null,
            unit_id: String(body.unitId || '').trim().slice(0, 64) || null,
            customer_id: customerRow?.id || null,
            hub_user_id: hubUserId,
            // Totem: null explícito (evita DEFAULT 'pix' do banco). Parceiros: método escolhido.
            payment_method: isTotem ? (paymentMethod || null) : paymentMethod || 'pix',
            payment_splits: paymentSplits,
            due_date: isCreditOrder || financialStatus === 'pendente' ? addDays(new Date(), dueDays) : null,
            financial_status: financialStatus,
        };
        // Taxa de entrega vai nos items — a tabela orders não tem coluna delivery_fee.

        let order;
        try {
            // Preferir RPC (trata channel/totem e payment_method null corretamente).
            order = await insertOrder(db.url, db.key, row, { useRpc: true });
        } catch (rpcErr) {
            try {
                order = await insertOrder(db.url, db.key, row, { useRpc: false });
            } catch (insertErr) {
                const msg = String(insertErr.message || '');
                if (!/column/i.test(msg)) throw insertErr;

                // Remove só campos opcionais que possam não existir — NUNCA channel/totem_*.
                const {
                    customer_id: _a,
                    hub_user_id: _b,
                    payment_splits: _ps,
                    due_date: _d,
                    delivery_date: _dd,
                    wants_invoice: _g,
                    nf_queue_status: _h,
                    hub_pedido_id: _i,
                    customer_cpf: _cpf,
                    ...legacyRow
                } = row;
                order = await insertOrder(db.url, db.key, legacyRow, { useRpc: false });
            }
        }

        // Cinto de segurança: pedido totem nunca pode ficar como parceiros/pix por DEFAULT do banco.
        if (isTotem && order?.id) {
            const savedChannel = String(order.channel || '').toLowerCase();
            if (savedChannel !== 'totem' || order.payment_method) {
                try {
                    order = await patchOrder(
                        db.url,
                        db.key,
                        order.id,
                        {
                            channel: 'totem',
                            payment_method: paymentMethod || null,
                            financial_status: financialStatus,
                            totem_id: row.totem_id,
                            totem_label: row.totem_label,
                            unit_id: row.unit_id,
                        },
                        { useRpc: db.useRpc },
                    );
                } catch (patchErr) {
                    console.error('orders/create totem channel repair', patchErr);
                }
            }
        }

        if (order && orderTabelaPrecoId && isDistribuidoraAccount(customerCnpj)) {
            order.order_tabela_preco_id = orderTabelaPrecoId;
        }

        if (isDistribuidoraAccount(customerCnpj) && orderClienteDocDigits) {
            try {
                await syncDistribuidoraClienteFinal(process.env, {
                    nome: orderClienteNome,
                    telefone: customerPhone,
                    docDigits: orderClienteDocDigits,
                    clienteAPrazo: orderClienteAPrazo,
                });
            } catch (syncErr) {
                console.warn('orders/create sync cliente final', syncErr?.message || syncErr);
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
                console.error('orders/create hub sync failed — pedido não chegou ao Hub', {
                    orderId: order.id,
                    hubUserId: order.hub_user_id || null,
                    customerEmail: order.customer_email || null,
                    hasServiceKey: Boolean(process.env.HUB_SUPABASE_SERVICE_ROLE_KEY),
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
