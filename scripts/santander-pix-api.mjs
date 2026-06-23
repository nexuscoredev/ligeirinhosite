import { santanderFetch } from './santander-http.mjs';

/** txid Pix (26–35 caracteres alfanuméricos, único por CNPJ). */
export function buildPixTxId(orderId) {
    const clean = String(orderId).replace(/-/g, '').toUpperCase();
    return `LIG${clean}`.replace(/[^A-Z0-9]/gi, '').slice(0, 35);
}

export async function santanderCreateImmediatePix(cfg, order, txid) {
    const amount = Number(order.total).toFixed(2);
    const path = cfg.cobPathTemplate.replace('{txid}', encodeURIComponent(txid));
    const shortId = String(order.id).slice(0, 8).toUpperCase();

    const body = {
        calendario: { expiracao: 86400 },
        valor: { original: amount },
        chave: cfg.pixKey,
        solicitacaoPagador: `Pedido Ligeirinho #${shortId}`,
    };

    return santanderFetch(cfg, path, { method: 'PUT', body });
}

export async function santanderGetImmediatePix(cfg, txid) {
    const path = cfg.cobPathTemplate.replace('{txid}', encodeURIComponent(txid));
    return santanderFetch(cfg, path, { method: 'GET' });
}

export function extractPixFromCob(cob) {
    if (!cob) return null;
    const qrCode =
        cob.pixCopiaECola ||
        cob.qrCodePix ||
        cob.qrCodeUrl ||
        cob.emv ||
        cob.location ||
        null;
    return {
        qr_code: qrCode,
        qr_code_base64: cob.qrCodeBase64 || cob.qr_code_base64 || null,
        txid: cob.txid || cob.txId || null,
        status: cob.status || null,
    };
}

export function mapSantanderPixStatusToOrder(status) {
    const normalized = String(status || '').toUpperCase();
    if (['CONCLUIDA', 'LIQUIDADO', 'LIQUIDADA', 'PAID', 'APPROVED'].includes(normalized)) {
        return 'paid';
    }
    if (['ATIVA', 'PENDING', 'EM_ABERTO'].includes(normalized)) {
        return 'pending_payment';
    }
    if (['REMOVIDA_PELO_USUARIO_RECEBEDOR', 'CANCELLED', 'CANCELADO'].includes(normalized)) {
        return 'cancelled';
    }
    return 'failed';
}

export function mapSantanderPixStatusToFinancial(status) {
    const orderStatus = mapSantanderPixStatusToOrder(status);
    if (orderStatus === 'paid') return 'pago';
    if (orderStatus === 'cancelled') return 'cancelado';
    if (orderStatus === 'pending_payment') return 'em_cobranca';
    return 'pendente';
}
