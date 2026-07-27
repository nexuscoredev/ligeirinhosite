import { hubConfig } from '../hub-auth.mjs';
import {
    buildParceiroExtras,
    fetchUsuarioById,
    resolveClienteParceiroForOrder,
} from '../hub-parceiro.mjs';
import { clienteParceirosFromPessoa } from '../parceiro-delivery.mjs';

/** Taxa padrão para pedidos Parceiros com entrega (R$). */
export const DEFAULT_PARCEIROS_DELIVERY_FEE = 100;

/** Produto Hub usado como linha de taxa de entrega nos pedidos espelhados. */
export const DELIVERY_FEE_HUB_PRODUCT_ID = '59af880d-0c08-4827-b2de-7ea5b10a6324';
export const DELIVERY_FEE_SKU = '1045';
export const DELIVERY_FEE_PRODUCT_NAME = 'TAXA DE ENTREGA HR';
export const DELIVERY_FEE_CART_KEY = 'taxa-entrega-hr';

export const roundMoney = (n) => Math.round(Number(n) * 100) / 100;

export function isDeliveryFeeLineItem(item) {
    if (!item) return false;
    if (item.isDeliveryFee === true) return true;
    const id = String(item.id || item.cartKey || '').toLowerCase();
    const sku = String(item.sku || '').trim();
    const hubId = String(item.hubId || item.hubProductId || '').toLowerCase();
    return (
        id === DELIVERY_FEE_CART_KEY ||
        sku === DELIVERY_FEE_SKU ||
        hubId === DELIVERY_FEE_HUB_PRODUCT_ID.toLowerCase()
    );
}

export function buildDeliveryFeeLineItem(fee) {
    const amount = roundMoney(fee);
    if (!amount || amount <= 0) return null;
    return {
        id: DELIVERY_FEE_CART_KEY,
        hubId: DELIVERY_FEE_HUB_PRODUCT_ID,
        sku: DELIVERY_FEE_SKU,
        cartKey: DELIVERY_FEE_CART_KEY,
        name: DELIVERY_FEE_PRODUCT_NAME,
        price: amount,
        qty: 1,
        packType: 'unidade',
        isDeliveryFee: true,
    };
}

/** Garante taxa de entrega como primeiro item (remove duplicatas). */
export function prependDeliveryFeeToItems(items, fee) {
    const rest = (items || []).filter((item) => !isDeliveryFeeLineItem(item));
    const line = buildDeliveryFeeLineItem(fee);
    if (!line) return rest;
    return [line, ...rest];
}

export function extractDeliveryFeeFromItems(items) {
    const feeItem = (items || []).find(isDeliveryFeeLineItem);
    if (!feeItem) return null;
    return roundMoney(Number(feeItem.price || 0) * Number(feeItem.qty || 1));
}

export function productItemsSubtotal(items) {
    return roundMoney(
        (items || [])
            .filter((item) => !isDeliveryFeeLineItem(item))
            .reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0),
    );
}

export function parseTaxaEntrega(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return null;
    return roundMoney(n);
}

/**
 * Resolve valor da taxa de entrega.
 * @param {object} opts
 * @param {string} [opts.channel]
 * @param {string} [opts.deliveryType]
 * @param {number|null|undefined} [opts.clientTaxaEntrega] — null/undefined = padrão R$100; 0 = isento
 */
export function resolveDeliveryFeeAmount({ channel = 'parceiros', deliveryType = 'entrega', clientTaxaEntrega } = {}) {
    if (String(channel || '').toLowerCase() === 'totem') return 0;
    if (deliveryType === 'retirada') return 0;

    const parsed = parseTaxaEntrega(clientTaxaEntrega);
    if (parsed === 0) return 0;
    if (parsed != null) return parsed;
    return DEFAULT_PARCEIROS_DELIVERY_FEE;
}

export function deliveryFeeLabel(fee) {
    if (!fee || fee <= 0) return 'Grátis';
    return fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function hubHeaders(config) {
    return {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        'Content-Type': 'application/json',
    };
}

async function hubRest(config, path, options = {}) {
    const res = await fetch(`${config.url}/rest/v1/${path}`, {
        method: options.method || 'GET',
        headers: hubHeaders(config),
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const text = await res.text();
    let data = null;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    }
    if (!res.ok) {
        const msg = data?.message || data?.error || text || `Hub ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

/** Busca taxa_entrega do cliente no Hub (coluna opcional — falha silenciosa). */
export async function fetchClienteTaxaEntrega(config, pessoa) {
    const cliente = clienteParceirosFromPessoa(pessoa);
    if (!cliente?.id || !config?.serviceKey) return null;
    try {
        const rows = await hubRest(
            config,
            `clientes?select=taxa_entrega&id=eq.${encodeURIComponent(cliente.id)}&limit=1`,
        );
        const row = Array.isArray(rows) ? rows[0] : null;
        return parseTaxaEntrega(row?.taxa_entrega);
    } catch {
        return null;
    }
}

export async function fetchClienteTaxaEntregaByClienteId(config, clienteId) {
    if (!clienteId || !config?.serviceKey) return null;
    try {
        const rows = await hubRest(
            config,
            `clientes?select=taxa_entrega&id=eq.${encodeURIComponent(clienteId)}&limit=1`,
        );
        const row = Array.isArray(rows) ? rows[0] : null;
        return parseTaxaEntrega(row?.taxa_entrega);
    } catch {
        return null;
    }
}

/**
 * Resolve taxa de entrega no servidor (autoritativo na criação do pedido).
 */
export async function resolveParceirosDeliveryFee(env = process.env, opts = {}) {
    const channel = String(opts.channel || 'parceiros').toLowerCase();
    const deliveryType = opts.deliveryType === 'retirada' ? 'retirada' : 'entrega';
    if (channel === 'totem' || deliveryType === 'retirada') return 0;

    const hub = hubConfig(env);
    if (!hub.serviceKey) {
        return resolveDeliveryFeeAmount({ channel, deliveryType, clientTaxaEntrega: null });
    }

    let clientTaxaEntrega = null;

    try {
        const hubUserId = String(opts.hubUserId || '').trim();
        if (hubUserId) {
            const usuario = await fetchUsuarioById(hub, hubUserId, hub.serviceKey);
            if (usuario) {
                const extras = await buildParceiroExtras(hub, usuario);
                if (extras.taxaEntrega != null) {
                    clientTaxaEntrega = extras.taxaEntrega;
                }
            }
        }

        if (clientTaxaEntrega == null && opts.order) {
            const cliente = await resolveClienteParceiroForOrder(hub, opts.order);
            if (cliente?.clienteId) {
                clientTaxaEntrega = await fetchClienteTaxaEntregaByClienteId(hub, cliente.clienteId);
            }
        }
    } catch (err) {
        console.warn('resolveParceirosDeliveryFee', err?.message || err);
    }

    return resolveDeliveryFeeAmount({ channel, deliveryType, clientTaxaEntrega });
}
