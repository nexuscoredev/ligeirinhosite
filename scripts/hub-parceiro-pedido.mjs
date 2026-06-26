import { hubConfig } from './hub-auth.mjs';
import { normalizeDocDigits } from './hub-parceiro.mjs';

export const PARCEIROS_NF_TAG = 'Ligeirinho Parceiros';

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

function buildObservacoes(order) {
    const parts = [PARCEIROS_NF_TAG];
    parts.push(`Pedido ${String(order.id || '').slice(0, 8).toUpperCase()}`);
    if (order.customer_name) parts.push(String(order.customer_name).trim());
    if (order.delivery_date) parts.push(`Entrega: ${formatDeliveryDate(order.delivery_date)}`);
    if (order.delivery_type === 'entrega' && order.address) {
        parts.push(`Endereço: ${String(order.address).trim()}`);
    }
    if (order.notes) parts.push(String(order.notes).trim());
    return parts.filter(Boolean).join(' · ').slice(0, 2000);
}

async function fetchClienteParceiro(config, order) {
    const hubUserId = String(order.hub_user_id || '').trim();
    if (!hubUserId) return null;

    const users = await hubRest(
        config,
        `usuarios?select=id,login,email,nome&id=eq.${encodeURIComponent(hubUserId)}&limit=1`,
    );
    const user = Array.isArray(users) ? users[0] : null;
    if (!user) return null;

    const digits = normalizeDocDigits(user.login);
    if (digits.length < 11) return null;

    const pessoas = await hubRest(
        config,
        `pessoas?select=id,nome,clientes(id,nome,canal_cliente,ativo)&cpf_cnpj_digits=eq.${encodeURIComponent(digits)}&limit=1`,
    );
    const pessoa = Array.isArray(pessoas) ? pessoas[0] : null;
    if (!pessoa?.id) return null;

    const clientes = Array.isArray(pessoa.clientes) ? pessoa.clientes : pessoa.clientes ? [pessoa.clientes] : [];
    const cliente = clientes.find((c) => c?.canal_cliente === 'parceiros' && c?.ativo !== false);
    if (!cliente?.id) return null;

    return { clienteId: cliente.id, pessoaId: pessoa.id, clienteNome: cliente.nome || pessoa.nome || user.nome };
}

export async function ensureHubPedidoNfParceiros(order, env = process.env) {
    const hub = hubConfig(env);
    if (!hub.serviceKey) return null;
    if (!order?.id || !order?.wants_invoice) return null;
    if (String(order.channel || 'parceiros').toLowerCase() === 'totem') return null;

    const existing = await buscarHubPedidoPorParceirosId(hub, order.id);
    if (existing) return existing;

    const cliente = await fetchClienteParceiro(hub, order);
    if (!cliente?.clienteId) {
        console.warn('hub-parceiro-pedido: cliente parceiro não encontrado no Hub', order.hub_user_id);
        return null;
    }

    const items = Array.isArray(order.items) ? order.items : [];
    const porSku = await resolverProdutosHub(hub, items);
    const total = Number(order.total) || 0;

    const pedidoBody = {
        cliente_id: cliente.clienteId,
        status: 'aguardando_emissao_nf',
        modalidade: order.delivery_type === 'retirada' ? 'retirada' : 'entrega',
        valor_pedido: total,
        pagamento_split: buildPagamentoSplit(order),
        parceiros_order_id: order.id,
        observacoes: buildObservacoes(order),
    };

    let pedidoRows;
    try {
        pedidoRows = await hubRest(hub, 'pedidos', {
            method: 'POST',
            headers: { Prefer: 'return=representation' },
            body: { ...pedidoBody, origem: 'parceiros' },
        });
    } catch (err) {
        if (!String(err.message || '').toLowerCase().includes('parceiros')) throw err;
        pedidoRows = await hubRest(hub, 'pedidos', {
            method: 'POST',
            headers: { Prefer: 'return=representation' },
            body: { ...pedidoBody, origem: 'app' },
        });
    }

    const pedido = Array.isArray(pedidoRows) ? pedidoRows[0] : pedidoRows;
    if (!pedido?.id) return null;

    const linhasInsert = [];
    for (const item of items) {
        const sku = String(item.id || item.cartKey || '').trim();
        const prod = sku ? porSku.get(sku) : null;
        if (!prod?.id) {
            console.warn(`hub-parceiro-pedido: SKU "${sku}" não encontrado no Hub — item ignorado`);
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
