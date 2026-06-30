import { hubConfig } from './hub-auth.mjs';
import { resolveClienteParceiroForOrder } from './hub-parceiro.mjs';
import { buildHubProductLookup, fetchHubProdutosForLookup } from './lib/hub-catalog.mjs';

export const PARCEIROS_NF_TAG = 'Ligeirinho Parceiros';
export const PARCEIROS_TAG = PARCEIROS_NF_TAG;

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

async function buscarHubPedidoPorParceirosId(config, parceirosOrderId) {
    const rows = await hubRest(
        config,
        `pedidos?select=id,numero,status,origem,parceiros_order_id&parceiros_order_id=eq.${encodeURIComponent(parceirosOrderId)}&limit=1`,
    );
    return Array.isArray(rows) ? rows[0] ?? null : null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolverProdutosHub(config, items = []) {
    const map = new Map();
    if (!items?.length) return map;

    const directKeys = [
        ...new Set(
            items
                .flatMap((item) => [item.hubId, item.hubProductId, item.sku, item.id, item.cartKey])
                .map((value) => String(value || '').trim())
                .filter(Boolean),
        ),
    ];

    const uuidKeys = directKeys.filter((key) => UUID_RE.test(key));
    if (uuidKeys.length) {
        const rows = await hubRest(
            config,
            `produtos?select=id,sku,ean,nome,categorias_produto(ordem_separacao)&id=in.(${uuidKeys.map(encodeURIComponent).join(',')})&ativo=eq.true`,
        );
        for (const row of rows || []) {
            if (row.id) map.set(String(row.id), row);
            if (row.sku) map.set(String(row.sku).trim(), row);
            if (row.ean) map.set(String(row.ean).trim(), row);
        }
    }

    const skuLikeKeys = directKeys.filter((key) => !UUID_RE.test(key) && !map.has(key));
    if (skuLikeKeys.length) {
        const or = skuLikeKeys
            .flatMap((s) => [`sku.eq.${encodeURIComponent(s)}`, `ean.eq.${encodeURIComponent(s)}`])
            .join(',');
        const rows = await hubRest(
            config,
            `produtos?select=id,sku,ean,nome,categorias_produto(ordem_separacao)&or=(${or})&ativo=eq.true`,
        );
        for (const row of rows || []) {
            if (row.id) map.set(String(row.id), row);
            if (row.sku) map.set(String(row.sku).trim(), row);
            if (row.ean) map.set(String(row.ean).trim(), row);
        }
    }

    const unresolved = items.filter((item) => !resolveProdutoForItem(map, item));
    if (unresolved.length) {
        const produtos = await fetchHubProdutosForLookup(config);
        const catalogIndex = buildHubProductLookup(produtos);
        for (const [key, row] of catalogIndex) {
            if (!map.has(key)) map.set(key, row);
        }
    }

    for (const item of items) {
        if (resolveProdutoForItem(map, item)) continue;
        const name = String(item.name || '').trim().toUpperCase();
        if (name.length < 4 || map.has(name)) continue;
        const byName = await hubRest(
            config,
            `produtos?select=id,sku,ean,nome,categorias_produto(ordem_separacao)&nome=ilike.${encodeURIComponent(name)}&ativo=eq.true&limit=3`,
        );
        const hit = Array.isArray(byName) ? byName[0] : null;
        if (!hit?.id) continue;
        map.set(name, hit);
        for (const key of itemLookupKeys(item)) map.set(key, hit);
    }

    return map;
}

function itemLookupKeys(item) {
    return [item.hubId, item.hubProductId, item.sku, item.id, item.cartKey, String(item.name || '').trim().toUpperCase()]
        .map((value) => String(value || '').trim())
        .filter(Boolean);
}

function resolveProdutoForItem(porSku, item) {
    for (const key of itemLookupKeys(item)) {
        const prod = porSku.get(key);
        if (prod?.id) return prod;
    }
    return null;
}

function parceirosMethodToHubForma(method) {
    const m = String(method || '').toLowerCase();
    if (m === 'pix' || m === 'mercado_pago') return 'pix';
    if (m === 'cartao') return 'cartao_debito';
    if (m === 'prazo' || m === 'boleto' || m === 'fiado' || m === 'credito') return 'crediario';
    return 'dinheiro';
}

function buildPagamentoSplit(order) {
    const total = Number(order.total) || 0;
    return [{ forma: parceirosMethodToHubForma(order.payment_method), valor: total }];
}

function formatDeliveryDate(value) {
    if (!value) return '';
    const raw = String(value).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const [y, m, d] = raw.split('-');
    return `${d}/${m}/${y}`;
}

function paymentMethodLabel(method) {
    const m = String(method || '').toLowerCase();
    if (m === 'pix') return 'Pix';
    if (m === 'mercado_pago') return 'Mercado Pago';
    if (m === 'dinheiro') return 'Dinheiro';
    if (m === 'cartao') return 'Cartão';
    if (m === 'prazo' || m === 'boleto' || m === 'fiado' || m === 'credito') return 'A prazo';
    return method ? String(method).trim() : '';
}

function buildObservacoes(order) {
    const parts = [PARCEIROS_TAG];
    parts.push(`Pedido ${String(order.id || '').slice(0, 8).toUpperCase()}`);
    if (order.customer_name) parts.push(String(order.customer_name).trim());
    if (order.payment_method) parts.push(`Pagamento: ${paymentMethodLabel(order.payment_method)}`);
    if (order.delivery_date) parts.push(`Entrega: ${formatDeliveryDate(order.delivery_date)}`);
    if (order.delivery_type === 'entrega' && order.address) {
        parts.push(`Endereço: ${String(order.address).trim()}`);
    }
    if (order.notes) parts.push(String(order.notes).trim());
    return parts.filter(Boolean).join(' · ').slice(0, 2000);
}

async function fetchClienteParceiro(hub, order) {
    return resolveClienteParceiroForOrder(hub, order);
}

async function fetchClienteHubMeta(hub, clienteId) {
    const rows = await hubRest(
        hub,
        `clientes?select=id,tabela_preco_id,tabela_preco&ativo=eq.true&id=eq.${encodeURIComponent(clienteId)}&limit=1`,
    );
    return Array.isArray(rows) ? rows[0] ?? null : null;
}

async function pedidoTemItens(hub, pedidoId) {
    const rows = await hubRest(
        hub,
        `pedido_itens?select=id&pedido_id=eq.${encodeURIComponent(pedidoId)}&limit=1`,
    );
    return Array.isArray(rows) && rows.length > 0;
}

function buildLinhasInsert(pedidoId, items, porSku) {
    const linhasInsert = [];
    for (const item of items) {
        const prod = resolveProdutoForItem(porSku, item);
        if (!prod?.id) {
            console.warn(
                `hub-parceiro-pedido: produto não encontrado no Hub — ${String(item.name || item.id || '').slice(0, 80)}`,
            );
            continue;
        }
        const cat = prod.categorias_produto;
        const catOrdem = (Array.isArray(cat) ? cat[0] : cat)?.ordem_separacao ?? 999;
        linhasInsert.push({
            pedido_id: pedidoId,
            produto_id: prod.id,
            nome_snapshot: String(item.name || prod.nome || 'Item').slice(0, 200),
            categoria_ordem: catOrdem,
            qty_pedida: Math.max(1, Number(item.qty) || 1),
            preco_unitario: Number(item.price) || 0,
        });
    }
    return linhasInsert;
}

async function inserirItensNoPedidoHub(hub, pedidoId, order) {
    const items = Array.isArray(order.items) ? order.items : [];
    if (!items.length) return false;

    const porSku = await resolverProdutosHub(hub, items);
    const linhasInsert = buildLinhasInsert(pedidoId, items, porSku);
    if (!linhasInsert.length) return false;

    await hubRest(hub, 'pedido_itens', {
        method: 'POST',
        body: linhasInsert,
    });
    await fetch(`${hub.url}/rest/v1/rpc/recalcular_totais_pedido`, {
        method: 'POST',
        headers: hubHeaders(hub),
        body: JSON.stringify({ p_pedido_id: pedidoId }),
    });
    return true;
}

async function createHubPedidoFromParceirosOrder(hub, order, { status }) {
    const cliente = await fetchClienteParceiro(hub, order);
    if (!cliente?.clienteId) {
        console.warn('hub-parceiro-pedido: cliente parceiro não encontrado no Hub', {
            hubUserId: order.hub_user_id,
            customerEmail: order.customer_email,
        });
        return null;
    }

    const clienteMeta = await fetchClienteHubMeta(hub, cliente.clienteId);
    const total = Number(order.total) || 0;

    const pedidoBody = {
        cliente_id: cliente.clienteId,
        status,
        origem: 'app',
        tipo_documento: 'orcamento',
        modalidade: order.delivery_type === 'retirada' ? 'retirada' : 'entrega',
        valor_pedido: total,
        pagamento_split: buildPagamentoSplit(order),
        parceiros_order_id: order.id,
        observacoes: buildObservacoes(order),
    };
    if (clienteMeta?.tabela_preco_id) {
        pedidoBody.tabela_preco_id = clienteMeta.tabela_preco_id;
    }

    const pedidoRows = await hubRest(hub, 'pedidos', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: pedidoBody,
    });

    const pedido = Array.isArray(pedidoRows) ? pedidoRows[0] : pedidoRows;
    if (!pedido?.id) return null;

    await inserirItensNoPedidoHub(hub, pedido.id, order);

    return pedido;
}

export async function ensureHubPedidoForParceiros(order, env = process.env) {
    const hub = hubConfig(env);
    if (!hub.serviceKey) return null;
    if (!order?.id) return null;
    if (String(order.channel || 'parceiros').toLowerCase() === 'totem') return null;

    const existing = await buscarHubPedidoPorParceirosId(hub, order.id);
    if (existing?.id) {
        const temItens = await pedidoTemItens(hub, existing.id);
        if (!temItens && Array.isArray(order.items) && order.items.length) {
            await inserirItensNoPedidoHub(hub, existing.id, order);
        }
        return existing;
    }

    return createHubPedidoFromParceirosOrder(hub, order, { status: 'pendente' });
}

export async function ensureHubPedidoNfParceiros(order, env = process.env) {
    const hub = hubConfig(env);
    if (!hub.serviceKey) return null;
    if (!order?.id || !order?.wants_invoice) return null;
    if (String(order.channel || 'parceiros').toLowerCase() === 'totem') return null;

    const existing = await buscarHubPedidoPorParceirosId(hub, order.id);
    if (existing?.id) {
        const temItens = await pedidoTemItens(hub, existing.id);
        if (!temItens && Array.isArray(order.items) && order.items.length) {
            await inserirItensNoPedidoHub(hub, existing.id, order);
        }
        return existing;
    }

    return createHubPedidoFromParceirosOrder(hub, order, { status: 'aguardando_emissao_nf' });
}
