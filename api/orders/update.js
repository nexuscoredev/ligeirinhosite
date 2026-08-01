import { requireAccountSession } from '../account/_require-hub-session.mjs';
import { collectParceiroOrderLookup } from '../../scripts/hub-parceiro.mjs';
import { updateHubPedidoForParceiros } from '../../scripts/hub-parceiro-pedido.mjs';
import { paymentEnv, assertOrderBackend } from '../../scripts/payment-env.mjs';
import {
    fetchOrderById,
    patchOrder,
    publicOrderView,
    dbFromPaymentConfig,
} from '../../scripts/supabase-orders.mjs';
import { releaseCredit, reserveCredit } from '../../scripts/supabase-finance.mjs';
import { validatePaymentSplits } from '../../scripts/lib/payment-splits.mjs';
import {
    resolveParceirosDeliveryFee,
    prependDeliveryFeeToItems,
    isDeliveryFeeLineItem,
    parseTaxaEntrega,
} from '../../scripts/lib/delivery-fee.mjs';
import { isDistribuidoraAccount } from '../../scripts/lib/distribuidora-account.mjs';
import { formatCpf, isValidCpf, normalizeCpfDigits } from '../../scripts/lib/cpf.mjs';
import { sanitizeCustomerPhone } from '../../scripts/lib/customer-phone.mjs';
import {
    fetchHubPedidoById,
    fetchHubPedidoByParceirosOrderId,
    buildOrderTracking,
} from '../../scripts/hub-order-tracking.mjs';
import {
    evaluateOrderEditPolicy,
    preserveEditPolicyTags,
    resolveAccountCnpj,
} from '../../scripts/lib/order-edit-policy.mjs';

export const config = { maxDuration: 30 };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CREDIT_METHODS = new Set(['fiado', 'credito', 'boleto', 'prazo']);
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

const normalizePaymentSplits = (raw, total) => {
    if (!Array.isArray(raw) || raw.length < 2) return null;
    const check = validatePaymentSplits(raw, total);
    if (!check.ok) {
        throw new Error(check.error || 'Pagamento dividido inválido.');
    }
    return check.splits;
};

function orderOwnedByLookup(order, lookup) {
    if (!order) return false;
    const hubIds = new Set(
        [...(lookup.hubUserIds || []), ...(lookup.legacyHubUserIds || [])]
            .map((id) => String(id || '').trim())
            .filter(Boolean),
    );
    const emails = new Set(
        (lookup.emails || []).map((e) => String(e || '').trim().toLowerCase()).filter(Boolean),
    );

    const orderHub = String(order.hub_user_id || '').trim();
    if (orderHub && hubIds.has(orderHub)) return true;

    const orderEmail = String(order.customer_email || '').trim().toLowerCase();
    if (orderEmail && emails.has(orderEmail)) return true;

    return false;
}

function orderUsesCredit(order) {
    const method = String(order.payment_method || '').toLowerCase();
    if (CREDIT_METHODS.has(method)) return true;
    const splits = Array.isArray(order.payment_splits) ? order.payment_splits : [];
    return splits.some((entry) => CREDIT_METHODS.has(String(entry?.method || '').toLowerCase()));
}

async function cancelPendingCharges(supabaseUrl, serviceKey, orderId) {
    if (!supabaseUrl || !serviceKey || !orderId) return;
    const url = `${supabaseUrl}/rest/v1/mp_charges?order_id=eq.${encodeURIComponent(orderId)}&status=eq.pending`;
    await fetch(url, {
        method: 'PATCH',
        headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
        },
        body: JSON.stringify({ status: 'cancelled', updated_at: new Date().toISOString() }),
    }).catch(() => null);
}

function buildOrderNotes(body, customer, paymentSplits, orderClienteNome, orderTabelaPrecoCodigo) {
    const customerCnpj = String(customer.cnpj || body.customerCnpj || '').trim();
    const customerCpf = normalizeCpfDigits(customer.cpf || customer.customerCpf || body.customerCpf || '');
    const notesBase = String(body.notes || '').trim();
    const notesParts = [
        notesBase,
        customerCnpj ? `CNPJ: ${customerCnpj}` : '',
        customerCpf && isValidCpf(customerCpf) ? `CPF na nota: ${formatCpf(customerCpf)}` : '',
    ].filter(Boolean);
    if (orderTabelaPrecoCodigo) notesParts.push(`Tabela: ${orderTabelaPrecoCodigo}`);
    if (orderClienteNome) notesParts.push(`Cliente: ${orderClienteNome}`);
    let notes = notesParts.join(' · ').slice(0, 2000) || null;
    if (paymentSplits?.length) {
        const human = paymentSplits
            .map((item) => `${item.method.toUpperCase()} R$ ${item.amount.toFixed(2).replace('.', ',')}`)
            .join('; ');
        const splitNote = `Pagamento dividido: ${human} [[lig-payment-splits:${JSON.stringify(paymentSplits)}]]`;
        const prefix = notes ? `${notes} · ` : '';
        const combined = `${prefix}${splitNote}`;
        notes = combined.length <= 2000 ? combined : `${String(notes || '').slice(0, Math.max(0, 2000 - splitNote.length - 3))} · ${splitNote}`;
    }
    return notes;
}

export default async function handler(req, res) {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const origin = host ? `${proto}://${host}` : null;
    const payConfig = paymentEnv(process.env, origin);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    let session;
    try {
        session = await requireAccountSession(req);
    } catch (err) {
        console.error('orders/update session', err);
        return res.status(503).json({ error: 'Falha ao validar sessão. Tente novamente.' });
    }
    if (session.error) {
        return res.status(session.status).json({ error: session.error });
    }

    const missing = assertOrderBackend(payConfig);
    if (missing.length) {
        return res.status(503).json({ error: 'Backend indisponível', missing });
    }

    const body = req.body || {};
    const orderId = String(body.orderId || body.id || '').trim();
    if (!UUID_RE.test(orderId)) {
        return res.status(400).json({ error: 'ID de pedido inválido' });
    }

    const items = normalizeItems(body.items);
    if (!items?.length) {
        return res.status(400).json({ error: 'Carrinho vazio ou inválido' });
    }

    try {
        const db = dbFromPaymentConfig(payConfig);
        const existing = await fetchOrderById(db.url, db.key, orderId, { useRpc: db.useRpc });
        if (!existing) {
            return res.status(404).json({ error: 'Pedido não encontrado' });
        }

        const authEmail = String(
            session.authUser?.email || session.usuario?.email || req.headers['x-account-email'] || '',
        ).trim();
        const lookup = await collectParceiroOrderLookup(session.config, session.usuario, {
            email: authEmail,
            sub: String(req.headers['x-auth-sub'] || body.sub || '').trim(),
        });

        if (!orderOwnedByLookup(existing, lookup)) {
            return res.status(403).json({ error: 'Você não pode editar este pedido.' });
        }

        if ((existing.channel || 'parceiros') !== 'parceiros') {
            return res.status(400).json({ error: 'Este pedido não pode ser editado por aqui.' });
        }

        if (existing.status === 'cancelled') {
            return res.status(409).json({ error: 'Pedido cancelado. Faça um novo pedido.' });
        }

        if (existing.status !== 'pending') {
            return res.status(409).json({
                error: 'Este pedido não está mais aguardando confirmação e não pode ser editado.',
            });
        }

        if (existing.financial_status === 'pago') {
            return res.status(409).json({ error: 'Pedido já pago. Fale com o suporte para alterar.' });
        }

        if (existing.financial_status === 'em_cobranca') {
            return res.status(409).json({
                error: 'Há um pagamento em andamento. Cancele a cobrança ou aguarde antes de editar.',
            });
        }

        const hubPedido =
            (existing.hub_pedido_id && (await fetchHubPedidoById(existing.hub_pedido_id))) ||
            (await fetchHubPedidoByParceirosOrderId(existing.id));
        const accountCnpj = resolveAccountCnpj(lookup.cnpjDigits || session.usuario, existing);
        const editPolicy = evaluateOrderEditPolicy(existing, {
            accountCnpj,
            hubStatus: hubPedido?.status,
        });
        if (!editPolicy.canEdit) {
            const message =
                editPolicy.editBlockedReason === 'delivery_day'
                    ? 'Hoje é o dia de entrega ou retirada. Solicite permissão para editar o pedido.'
                    : 'Este pedido não pode ser editado.';
            return res.status(409).json({ error: message, policy: editPolicy });
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
        const customerCpfRaw = customer.cpf || customer.customerCpf || body.customerCpf || existing.customer_cpf || '';
        const customerCpfDigits = normalizeCpfDigits(customerCpfRaw);
        if (customerCpfDigits && !isValidCpf(customerCpfDigits)) {
            return res.status(400).json({ error: 'CPF inválido. Confira os dígitos e tente novamente.' });
        }
        const customerCpf = customerCpfDigits.length === 11 ? customerCpfDigits : null;
        const hubUserId =
            String(body.hubUserId || customer.hubUserId || existing.hub_user_id || '').trim() || null;

        const customerCnpj = String(customer.cnpj || body.customerCnpj || '').trim();
        const orderTaxaRaw = body.orderTaxaEntrega;
        const hasOrderTaxa =
            orderTaxaRaw !== undefined && orderTaxaRaw !== null && orderTaxaRaw !== '';
        const deliveryFee = (() => {
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
                      channel: 'parceiros',
                      deliveryType,
                      hubUserId,
                  });

        const orderItems = prependDeliveryFeeToItems(items, resolvedDeliveryFee);
        const total = roundMoney(orderItems.reduce((sum, item) => sum + item.price * item.qty, 0));

        let paymentMethod = String(body.paymentMethod || body.payment || existing.payment_method || '')
            .toLowerCase()
            .trim();
        let paymentSplits = null;
        try {
            paymentSplits = normalizePaymentSplits(body.paymentSplits || body.payment_splits, total);
        } catch (splitErr) {
            return res.status(400).json({ error: splitErr.message || 'Pagamento dividido inválido.' });
        }
        if (paymentSplits?.length) {
            paymentMethod = paymentSplits.map((item) => item.method).join('+');
        }
        if (!paymentMethod) paymentMethod = 'pix';

        const isCreditOrder = paymentSplits?.length
            ? paymentSplits.some((item) => CREDIT_METHODS.has(item.method))
            : CREDIT_METHODS.has(paymentMethod);

        const orderTabelaPrecoId = String(body.orderTabelaPrecoId || '').trim();
        const orderTabelaPrecoCodigo = String(body.orderTabelaPrecoCodigo || '').trim();
        const orderClienteNome = String(body.orderClienteNome || '').trim().slice(0, 120);
        const customerPhone = sanitizeCustomerPhone(customer.phone || existing.customer_phone, {
            cpf: customerCpf,
            cnpj: customerCnpj,
        });

        let notes = buildOrderNotes(
            body,
            customer,
            paymentSplits,
            orderClienteNome,
            orderTabelaPrecoCodigo,
        );
        notes = preserveEditPolicyTags(existing.notes, notes);

        const patch = {
            items: orderItems,
            total,
            delivery_fee: resolvedDeliveryFee,
            delivery_type: deliveryType,
            delivery_date: deliveryDate,
            address: deliveryType === 'entrega' ? address : null,
            notes,
            customer_name:
                orderClienteNome ||
                String(customer.name || existing.customer_name || '').trim().slice(0, 120) ||
                null,
            customer_phone: customerPhone ? customerPhone.slice(0, 32) : null,
            customer_email:
                String(customer.email || existing.customer_email || '').trim().slice(0, 120) || null,
            customer_cpf: customerCpf,
            payment_method: paymentMethod,
            payment_splits: paymentSplits,
            financial_status: 'pendente',
            status: 'pending',
        };

        if (existing.customer_id && orderUsesCredit(existing)) {
            try {
                await releaseCredit(
                    payConfig.supabaseUrl,
                    payConfig.supabaseServiceKey,
                    existing.customer_id,
                    Number(existing.total) || 0,
                );
            } catch (creditErr) {
                console.warn('orders/update releaseCredit', creditErr?.message || creditErr);
            }
        }

        if (existing.customer_id && isCreditOrder) {
            try {
                await reserveCredit(
                    payConfig.supabaseUrl,
                    payConfig.supabaseServiceKey,
                    existing.customer_id,
                    total,
                );
            } catch (creditErr) {
                return res.status(402).json({ error: creditErr.message || 'Limite de crédito excedido.' });
            }
        }

        let order = await patchOrder(db.url, db.key, orderId, patch, { useRpc: db.useRpc });
        if (orderTabelaPrecoId && isDistribuidoraAccount(customerCnpj)) {
            order = { ...order, order_tabela_preco_id: orderTabelaPrecoId };
        }

        const hubResult = await updateHubPedidoForParceiros(order, process.env);
        if (!hubResult.ok) {
            return res.status(409).json({
                error: hubResult.message,
                code: hubResult.code,
            });
        }

        if (hubResult.hubPedido?.id && order.hub_pedido_id !== hubResult.hubPedido.id) {
            order = await patchOrder(
                db.url,
                db.key,
                order.id,
                { hub_pedido_id: hubResult.hubPedido.id },
                { useRpc: db.useRpc },
            );
        }

        await cancelPendingCharges(payConfig.supabaseUrl, payConfig.supabaseServiceKey, order.id);

        const view = publicOrderView(order);
        const tracking = buildOrderTracking(view, hubResult.hubPedido, { accountCnpj });
        return res.status(200).json({
            orderId: order.id,
            order: view,
            tracking,
            hubPedidoId: hubResult.hubPedido?.id ?? null,
            hubSyncOk: Boolean(hubResult.hubPedido?.id),
        });
    } catch (err) {
        console.error('orders/update', err);
        return res.status(500).json({ error: err.message || 'Erro ao atualizar pedido.' });
    }
}
