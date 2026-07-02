import { hubConfig } from './hub-auth.mjs';
import { normalizeTotemPaymentMethod, paymentMethodLabel } from './supabase-caixa.mjs';
import {
    formatTotemCode,
    normalizeTotemCode,
    parseTotemOrderCode,
} from './totem-order-code.mjs';

export { formatTotemCode, normalizeTotemCode, parseTotemOrderCode };
export { isTotemOrderCodeScannerInput as isTotemOrderCodeInput } from './totem-order-code.mjs';

const CLIENTE_TOTEM_NOME = 'Totem — Varejo Loja';

function hubHeaders(config, extra = {}) {
    return {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        'Content-Type': 'application/json',
        ...extra,
    };
}

async function hubRest(config, path, options = {}) {
    if (!config.serviceKey) return null;
    const res = await fetch(`${config.url}/rest/v1/${path}`, {
        method: options.method || 'GET',
        headers: hubHeaders(config, options.headers || {}),
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
        const err = new Error(data?.message || data?.error || text || `Hub ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return data;
}

function totemMethodToHubForma(method) {
    const m = normalizeTotemPaymentMethod(method);
    if (m === 'pix') return 'pix';
    if (m === 'cartao') return 'cartao_debito';
    return 'dinheiro';
}

function roundMoney(n) {
    return Math.round(Number(n) * 100) / 100;
}

const SPLIT_MARKER = '[[lig-payment-splits:';
const SPLIT_MARKER_END = ']]';

function parseSplitsFromNotes(notes) {
    const text = String(notes || '');
    const start = text.indexOf(SPLIT_MARKER);
    if (start === -1) return [];
    const end = text.indexOf(SPLIT_MARKER_END, start);
    if (end === -1) return [];
    try {
        const parsed = JSON.parse(text.slice(start + SPLIT_MARKER.length, end));
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((entry) => ({
                method: normalizeTotemPaymentMethod(entry?.method || entry?.id),
                amount: roundMoney(entry?.amount),
            }))
            .filter((entry) => entry.method && entry.amount > 0);
    } catch {
        return [];
    }
}

function resolveOrderSplits(order) {
    const raw = order.payment_splits || order.paymentSplits;
    if (Array.isArray(raw) && raw.length) {
        return raw
            .map((entry) => ({
                method: normalizeTotemPaymentMethod(entry?.method || entry?.id),
                amount: roundMoney(entry?.amount),
            }))
            .filter((entry) => entry.method && entry.amount > 0);
    }
    return parseSplitsFromNotes(order.notes);
}

function buildPagamentoSplit(order) {
    const splits = resolveOrderSplits(order);
    if (splits.length) {
        return splits.map((entry) => ({
            forma: totemMethodToHubForma(entry.method),
            valor: entry.amount,
        }));
    }
    const total = Number(order.total) || 0;
    const forma = totemMethodToHubForma(order.payment_method);
    return [{ forma, valor: total }];
}

function buildObservacoesTotem(order) {
    const totemLabel = order.totem_label || 'Ligeirinho Totem';
    const code = formatTotemCode(order.id);
    const parts = [`${totemLabel} · código ${code}`];
    const splits = resolveOrderSplits(order);
    if (splits.length >= 2) {
        parts.push(
            `Pagamento dividido: ${splits
                .map(
                    (item) =>
                        `${paymentMethodLabel(item.method)} R$ ${item.amount.toFixed(2).replace('.', ',')}`,
                )
                .join(' + ')}`,
        );
    } else if (order.payment_method) {
        parts.push(`Pagamento: ${paymentMethodLabel(order.payment_method)}`);
    }
    return parts.join(' · ').slice(0, 2000);
}

async function syncHubPedidoPagamento(hub, pedido, order) {
    if (!pedido?.id || pedido.pagamento_recebido_em) return pedido;
    const total = Number(order.total) || 0;
    const rows = await hubRest(hub, `pedidos?id=eq.${encodeURIComponent(pedido.id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: {
            valor_pedido: total,
            pagamento_split: buildPagamentoSplit(order),
            observacoes: buildObservacoesTotem(order),
        },
    });
    return Array.isArray(rows) ? rows[0] ?? pedido : pedido;
}

async function buscarClienteTotem(config) {
    const rows = await hubRest(
        config,
        `clientes?select=id,nome&nome=eq.${encodeURIComponent(CLIENTE_TOTEM_NOME)}&ativo=eq.true&limit=1`,
    );
    return Array.isArray(rows) ? rows[0]?.id ?? null : null;
}

async function buscarHubPedidoPorParceirosId(config, parceirosOrderId) {
    const rows = await hubRest(
        config,
        `pedidos?select=id,numero,status,pagamento_recebido_em,origem,parceiros_order_id&parceiros_order_id=eq.${encodeURIComponent(parceirosOrderId)}&limit=1`,
    );
    return Array.isArray(rows) ? rows[0] ?? null : null;
}

async function resolverProdutosHub(config, items = []) {
    const skus = [
        ...new Set(
            (items || [])
                .map((item) => String(item.id || item.cartKey || '').trim())
                .filter(Boolean),
        ),
    ];
    if (!skus.length) return new Map();

    const or = skus
        .flatMap((s) => [`sku.eq.${encodeURIComponent(s)}`, `ean.eq.${encodeURIComponent(s)}`])
        .join(',');
    const rows = await hubRest(
        config,
        `produtos?select=id,sku,nome,categorias_produto(ordem_separacao)&or=(${or})&ativo=eq.true`,
    );
    const map = new Map();
    for (const row of rows || []) {
        if (row.sku) map.set(row.sku, row);
    }
    return map;
}

const TOTEM_ORDER_SELECT =
    'id,total,customer_name,totem_label,unit_id,created_at,payment_method,items,notes,status,financial_status,channel';

function parceirosHeaders(parceirosKey) {
    return {
        apikey: parceirosKey,
        Authorization: `Bearer ${parceirosKey}`,
        'Content-Type': 'application/json',
    };
}

async function parceirosRest(parceirosUrl, parceirosKey, path, options = {}) {
    const res = await fetch(`${parceirosUrl}/rest/v1/${path}`, {
        method: options.method || 'GET',
        headers: parceirosHeaders(parceirosKey),
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const rows = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, rows, message: rows?.message };
}

function pickTotemOrderByPrefix(list, prefix) {
    if (!Array.isArray(list) || !list.length) return null;
    return list.find((o) => String(o.id || '').toLowerCase().startsWith(prefix)) || list[0];
}

export async function lookupTotemOrderByCode(parceirosUrl, parceirosKey, code) {
    const prefix = parseTotemOrderCode(code);
    if (!prefix) {
        const err = new Error(
            'Código inválido — use PED seguido dos 4 caracteres do comprovante (ex.: PED 4F4F).',
        );
        err.status = 400;
        throw err;
    }

    // 1) Coluna texto totem_code (eq) — sem cast/ilike em uuid.
    {
        const { ok, rows } = await parceirosRest(
            parceirosUrl,
            parceirosKey,
            `orders?channel=eq.totem&totem_code=eq.${encodeURIComponent(prefix)}&select=${TOTEM_ORDER_SELECT}&order=created_at.desc&limit=5`,
        );
        if (ok) {
            const order = pickTotemOrderByPrefix(rows, prefix);
            if (order) return order;
        }
    }

    // 2) RPC server-side (id::text no SQL, não via PostgREST filter).
    {
        const res = await fetch(`${parceirosUrl}/rest/v1/rpc/rpc_lookup_totem_order_by_code`, {
            method: 'POST',
            headers: parceirosHeaders(parceirosKey),
            body: JSON.stringify({ p_prefix: prefix }),
        });
        if (res.ok) {
            const data = await res.json().catch(() => null);
            if (data && typeof data === 'object' && data.id) return data;
        }
    }

    // 3) Fallback: pedidos totem recentes + filtro em memória.
    {
        const { ok, rows, message } = await parceirosRest(
            parceirosUrl,
            parceirosKey,
            `orders?channel=eq.totem&select=${TOTEM_ORDER_SELECT}&order=created_at.desc&limit=120`,
        );
        if (!ok) {
            const err = new Error(message || 'Erro ao buscar pedido');
            err.status = 500;
            throw err;
        }
        const order = pickTotemOrderByPrefix(rows, prefix);
        if (!order) {
            const err = new Error(`Pedido ${prefix.toUpperCase()} não encontrado.`);
            err.status = 404;
            throw err;
        }
        return order;
    }
}

export function publicTotemLookupView(order, hubPedido = null) {
    const splits = resolveOrderSplits(order);
    const pagamentoSplit = buildPagamentoSplit(order);
    return {
        orderId: order.id,
        code: formatTotemCode(order.id),
        codeRaw: normalizeTotemCode(order.id).toUpperCase(),
        total: Number(order.total) || 0,
        items: Array.isArray(order.items) ? order.items : [],
        paymentMethod: normalizeTotemPaymentMethod(order.payment_method),
        paymentSplits: splits.map((item) => ({
            method: item.method,
            label: paymentMethodLabel(item.method),
            amount: item.amount,
        })),
        pagamentoSplit,
        isSplitPayment: splits.length >= 2,
        totemLabel: order.totem_label || 'Ligeirinho Totem',
        status: order.status,
        financialStatus: order.financial_status,
        createdAt: order.created_at,
        canPay:
            order.status !== 'paid' &&
            order.financial_status === 'aguardando_caixa' &&
            Boolean(order.payment_method),
        alreadyPaid: order.status === 'paid',
        hubPedidoNumero: hubPedido?.numero ?? null,
        hubPedidoId: hubPedido?.id ?? null,
    };
}

export async function ensureHubPedidoForTotem(order, env = process.env) {
    const hub = hubConfig(env);
    if (!hub.serviceKey) return null;
    if (!order?.id || String(order.channel || '').toLowerCase() !== 'totem') return null;

    const existing = await buscarHubPedidoPorParceirosId(hub, order.id);
    if (existing) {
        return syncHubPedidoPagamento(hub, existing, order);
    }

    if (order.financial_status !== 'aguardando_caixa' || !order.payment_method) {
        return null;
    }

    const clienteId = await buscarClienteTotem(hub);
    if (!clienteId) {
        console.warn('hub-totem-pedido: cliente totem não encontrado no Hub');
        return null;
    }

    const items = Array.isArray(order.items) ? order.items : [];
    const porSku = await resolverProdutosHub(hub, items);
    const total = Number(order.total) || 0;

    const pedidoRows = await hubRest(hub, 'pedidos', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: {
            cliente_id: clienteId,
            status: 'aguardando_pagamento',
            origem: 'totem',
            modalidade: 'retirada',
            valor_pedido: total,
            pagamento_split: buildPagamentoSplit(order),
            parceiros_order_id: order.id,
            observacoes: buildObservacoesTotem(order),
        },
    });

    const pedido = Array.isArray(pedidoRows) ? pedidoRows[0] : pedidoRows;
    if (!pedido?.id) return null;

    const linhasInsert = [];
    for (const item of items) {
        const sku = String(item.id || item.cartKey || '').trim();
        const prod = sku ? porSku.get(sku) : null;
        if (!prod?.id) {
            console.warn(`hub-totem-pedido: SKU "${sku}" não encontrado no Hub — item ignorado`);
            continue;
        }
        const cat = prod.categorias_produto;
        const catOrdem = (Array.isArray(cat) ? cat[0] : cat)?.ordem_separacao ?? 999;
        linhasInsert.push({
            pedido_id: pedido.id,
            produto_id: prod.id,
            nome_snapshot: String(item.name || prod.nome || 'Item').slice(0, 200),
            categoria_ordem: catOrdem,
            qty_pedida: Math.max(1, Number(item.qty) || 1),
            preco_unitario: Number(item.price) || 0,
        });
    }

    if (linhasInsert.length) {
        await hubRest(hub, 'pedido_itens', {
            method: 'POST',
            body: linhasInsert,
        });
        await fetch(`${hub.url}/rest/v1/rpc/recalcular_totais_pedido`, {
            method: 'POST',
            headers: hubHeaders(hub),
            body: JSON.stringify({ p_pedido_id: pedido.id }),
        });
    }

    return pedido;
}

export async function confirmHubPedidoForTotem(order, env = process.env, operator = '') {
    const hub = hubConfig(env);
    if (!hub.serviceKey || !order?.id) return null;

    let pedido = await buscarHubPedidoPorParceirosId(hub, order.id);
    if (!pedido) {
        pedido = await ensureHubPedidoForTotem(order, env);
    }
    if (!pedido?.id) return null;

    if (pedido.pagamento_recebido_em) {
        return pedido;
    }

    const agora = new Date().toISOString();
    const op = String(operator || '').trim().slice(0, 64);
    const nota = op ? `PDV ${op}` : 'PDV';

    const rows = await hubRest(hub, `pedidos?id=eq.${encodeURIComponent(pedido.id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: {
            status: 'aguardando_separacao',
            pagamento_recebido_em: agora,
            aceito_em: agora,
            pagamento_split: buildPagamentoSplit(order),
            observacoes: `${buildObservacoesTotem(order)} · ${nota}`,
        },
    });

    return Array.isArray(rows) ? rows[0] ?? pedido : pedido;
}

export async function enrichTotemLookup(order, env = process.env) {
    const hub = hubConfig(env);
    if (!hub.serviceKey) return publicTotemLookupView(order, null);
    const hubPedido = await buscarHubPedidoPorParceirosId(hub, order.id);
    return publicTotemLookupView(order, hubPedido);
}
