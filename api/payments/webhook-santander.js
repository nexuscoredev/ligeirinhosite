import { paymentEnv } from '../../scripts/payment-env.mjs';
import {
    fetchOrderById,
    fetchOrderByPixTxid,
    patchOrder,
    dbFromPaymentConfig,
} from '../../scripts/supabase-orders.mjs';
import { santanderConfigFromEnv, assertSantanderPixConfig } from '../../scripts/santander-http.mjs';
import {
    mapSantanderPixStatusToOrder,
    mapSantanderPixStatusToFinancial,
    santanderGetImmediatePix,
} from '../../scripts/santander-pix-api.mjs';
import {
    releaseCredit,
    getFinanceSettings,
    getOrCreateWallet,
    walletTransaction,
    insertPaymentEvent,
} from '../../scripts/supabase-finance.mjs';
import { maybeInitSeparation } from '../../scripts/separation-init.mjs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function applyCashback(config, order) {
    if (!order.customer_id) return;
    try {
        const settings = await getFinanceSettings(config.supabaseUrl, config.supabaseServiceKey);
        const pct = Number(settings?.cashback_percent_default) || 0;
        if (pct <= 0) return;
        const amount = Math.round(Number(order.total) * (pct / 100) * 100) / 100;
        if (amount <= 0) return;
        const wallet = await getOrCreateWallet(
            config.supabaseUrl,
            config.supabaseServiceKey,
            order.customer_id,
            order.hub_user_id
        );
        await walletTransaction(config.supabaseUrl, config.supabaseServiceKey, {
            walletId: wallet.id,
            type: 'cashback',
            amount,
            description: `Cashback ${pct}% pedido #${String(order.id).slice(0, 8).toUpperCase()}`,
            orderId: order.id,
            createdBy: 'webhook',
        });
    } catch (err) {
        console.error('cashback', err);
    }
}

function extractTxId(body) {
    if (!body || typeof body !== 'object') return null;
    return (
        body.txId ||
        body.txid ||
        body.txID ||
        body.pix?.txid ||
        body.data?.txId ||
        body.data?.txid ||
        null
    );
}

function extractOrderId(body) {
    if (!body || typeof body !== 'object') return null;
    const ref =
        body.external_reference ||
        body.externalReference ||
        body.clientNumber ||
        body.participantCode ||
        body.data?.external_reference;
    if (ref && UUID_RE.test(String(ref))) return String(ref);
    return null;
}

function isPaidWebhook(body) {
    const paymentType = String(body?.paymentType || body?.payment_type || '').toUpperCase();
    const status = String(body?.status || body?.pixStatus || body?.paymentStatus || '').toUpperCase();
    if (paymentType === 'PIX' && !status) return true;
    return ['CONCLUIDA', 'LIQUIDADO', 'LIQUIDADA', 'PAID', 'APPROVED', 'SETTLED'].includes(status);
}

async function markOrderPaid(config, order, { txid, payload, eventType = 'paid' }) {
    const db = dbFromPaymentConfig(config);
    const paidAt = new Date().toISOString();
    const patch = {
        status: 'paid',
        financial_status: 'pago',
        pix_provider: 'santander',
        pix_txid: txid || order.pix_txid || null,
        paid_at: paidAt,
    };

    await patchOrder(db.url, db.key, order.id, patch, { useRpc: db.useRpc });

    await maybeInitSeparation(
        db.url,
        db.key,
        { ...order, status: 'paid', paid_at: paidAt },
        process.env,
        { useRpc: db.useRpc }
    );

    if (order.customer_id) {
        await releaseCredit(config.supabaseUrl, config.supabaseServiceKey, order.customer_id, Number(order.total));
        await applyCashback(config, order);
    }

    await insertPaymentEvent(config.supabaseUrl, config.supabaseServiceKey, {
        source: 'santander',
        event_type: eventType,
        order_id: order.id,
        payload: { txid, body: payload || null },
    });

    return order.id;
}

async function syncByTxid(config, txid, reqBody) {
    const db = dbFromPaymentConfig(config);
    let order = await fetchOrderByPixTxid(db.url, db.key, txid, { useRpc: db.useRpc });
    if (!order) {
        const orderId = extractOrderId(reqBody);
        if (orderId) {
            order = await fetchOrderById(db.url, db.key, orderId, { useRpc: db.useRpc });
        }
    }
    if (!order) return null;

    if (isPaidWebhook(reqBody)) {
        return markOrderPaid(config, order, { txid, payload: reqBody, eventType: 'pix_paid' });
    }

    const sCfg = santanderConfigFromEnv(process.env);
    if (assertSantanderPixConfig(sCfg).length) return order.id;

    try {
        const cob = await santanderGetImmediatePix(sCfg, txid);
        const orderStatus = mapSantanderPixStatusToOrder(cob.status);
        const financialStatus = mapSantanderPixStatusToFinancial(cob.status);
        const paidAt = orderStatus === 'paid' ? new Date().toISOString() : order.paid_at;

        await patchOrder(
            db.url,
            db.key,
            order.id,
            {
                status: orderStatus,
                financial_status: financialStatus,
                pix_provider: 'santander',
                pix_txid: txid,
                ...(paidAt ? { paid_at: paidAt } : {}),
            },
            { useRpc: db.useRpc }
        );

        if (orderStatus === 'paid') {
            await maybeInitSeparation(
                db.url,
                db.key,
                { ...order, status: orderStatus, paid_at: paidAt },
                process.env,
                { useRpc: db.useRpc }
            );
            if (order.customer_id) {
                await releaseCredit(
                    config.supabaseUrl,
                    config.supabaseServiceKey,
                    order.customer_id,
                    Number(order.total)
                );
                await applyCashback(config, order);
            }
        }

        await insertPaymentEvent(config.supabaseUrl, config.supabaseServiceKey, {
            source: 'santander',
            event_type: cob.status || 'sync',
            order_id: order.id,
            payload: { txid, status: cob.status, body: reqBody || null },
        });
    } catch (err) {
        console.error('webhook-santander sync', err);
    }

    return order.id;
}

export default async function handler(req, res) {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const origin = host ? `${proto}://${host}` : null;
    const config = paymentEnv(process.env, origin);
    const sCfg = santanderConfigFromEnv(process.env);

    if (req.method !== 'POST') {
        return res.status(405).end();
    }

    if (assertSantanderPixConfig(sCfg).length) {
        return res.status(503).json({ ok: false, missing: assertSantanderPixConfig(sCfg) });
    }

    if (sCfg.webhookSecret) {
        const token = req.headers['x-webhook-token'] || req.headers['x-santander-webhook-token'];
        if (String(token || '') !== sCfg.webhookSecret) {
            return res.status(401).json({ ok: false });
        }
    }

    try {
        const body = req.body || {};
        const txid = extractTxId(body);
        if (txid) {
            await syncByTxid(config, String(txid), body);
        }

        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error('payments/webhook-santander', err);
        return res.status(200).json({ ok: true });
    }
}
