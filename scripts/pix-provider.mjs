import {
    mpCreatePixPayment,
    extractPixFromPayment,
    mapMpStatusToOrder,
} from './mercadopago-api.mjs';
import {
    santanderConfigFromEnv,
    assertSantanderPixConfig,
} from './santander-http.mjs';
import {
    buildPixTxId,
    santanderCreateImmediatePix,
    extractPixFromCob,
    mapSantanderPixStatusToOrder,
} from './santander-pix-api.mjs';

export function resolvePixProvider(env = process.env, order = null) {
    const explicit = String(env.PIX_PROVIDER || '').trim().toLowerCase();
    if (explicit === 'santander' || explicit === 'mercadopago') {
        return explicit;
    }

    const santanderReady = assertSantanderPixConfig(santanderConfigFromEnv(env)).length === 0;
    const method = String(order?.payment_method || '').toLowerCase();
    if (method === 'pix' && santanderReady) return 'santander';
    if (santanderReady && !env.MP_ACCESS_TOKEN) return 'santander';
    return 'mercadopago';
}

export function isSantanderPixConfigured(env = process.env) {
    return assertSantanderPixConfig(santanderConfigFromEnv(env)).length === 0;
}

/**
 * Cria cobrança Pix e devolve dados normalizados para persistir no pedido.
 */
export async function createPixCharge({ env, config, order, notificationUrl }) {
    const provider = resolvePixProvider(env, order);

    if (provider === 'santander') {
        const sCfg = santanderConfigFromEnv(env);
        const missing = assertSantanderPixConfig(sCfg);
        if (missing.length) {
            const err = new Error('Pix Santander indisponível');
            err.status = 503;
            err.details = { missing };
            throw err;
        }

        const txid = order.pix_txid || buildPixTxId(order.id);
        const cob = await santanderCreateImmediatePix(sCfg, order, txid);
        const pix = extractPixFromCob(cob);
        const orderStatus = mapSantanderPixStatusToOrder(cob.status);

        return {
            provider: 'santander',
            txid: pix?.txid || txid,
            orderStatus,
            providerStatus: cob.status || 'ATIVA',
            providerStatusDetail: null,
            mpPaymentId: null,
            pix,
        };
    }

    if (!config.mpAccessToken) {
        const err = new Error('Pix indisponível');
        err.status = 503;
        err.details = { missing: ['MP_ACCESS_TOKEN'] };
        throw err;
    }

    const payment = await mpCreatePixPayment(
        config.mpAccessToken,
        order,
        notificationUrl,
        `lig-pix-${order.id}-${Date.now()}`
    );
    const pix = extractPixFromPayment(payment);

    return {
        provider: 'mercadopago',
        txid: null,
        orderStatus: mapMpStatusToOrder(payment.status),
        providerStatus: payment.status,
        providerStatusDetail: payment.status_detail || null,
        mpPaymentId: payment.id,
        pix,
    };
}
