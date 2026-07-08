import { hubConfig } from '../hub-auth.mjs';
import { slugifyId } from './hub-catalog.mjs';

const INDEFINIDO_SKU = 'indefinido';

function hubHeaders(config, token) {
    return {
        apikey: config.anonKey,
        Authorization: `Bearer ${token || config.anonKey}`,
        'Content-Type': 'application/json',
    };
}

function todayIsoDate(timezone = 'America/Sao_Paulo') {
    try {
        return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
    } catch {
        return new Date().toISOString().slice(0, 10);
    }
}

function isDrivePromoImage(url) {
    const value = String(url || '').trim().toLowerCase();
    if (!value) return false;
    return (
        value.includes('drive.google.com') ||
        value.includes('/marketing-artes/drive/') ||
        value.includes('/storage/v1/object/') && value.includes('/drive/')
    );
}

export function isCaixaPromoUnidade(unidade) {
    const u = String(unidade || '').trim().toUpperCase();
    return u === 'CX' || u === 'FD';
}

function normalizePromoLookupName(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizePromoRow(row, meta = null, produto = null) {
    const original = Number(row.preco_original);
    const promo = Number(row.preco_promo);
    const discountPct =
        Number.isFinite(original) && original > 0 && Number.isFinite(promo)
            ? Math.max(0, Math.round((1 - promo / original) * 100))
            : 0;

    const nome = String(row.produto_nome || produto?.nome || '').trim();
    const rawImage = row.arte_url || produto?.imagem_url || null;
    const imageUrl = isDrivePromoImage(rawImage) ? produto?.imagem_url || null : rawImage;
    const unidade = String(meta?.unidade || row.unidade || '').trim().toUpperCase();

    return {
        id: row.id,
        sku: String(row.produto_sku || '').trim(),
        hubProductId: meta?.produto_id || (row.produto_id ? String(row.produto_id).trim() : null),
        name: nome,
        unidade,
        originalPrice: Number.isFinite(original) ? original : null,
        promoPrice: Number.isFinite(promo) ? promo : null,
        discountPct,
        validFrom: String(row.validade_inicio || '').slice(0, 10),
        validTo: String(meta?.validade_fim || row.validade_fim || '').slice(0, 10),
        imageUrl,
        catalogProductId: nome ? slugifyId(nome) : produto?.nome ? slugifyId(produto.nome) : null,
        hubProductName: nome || (produto?.nome ? String(produto.nome).trim() : null),
        active: row.ativo !== false,
    };
}

async function fetchPromoCatalogMetaMaps(config, token, canal = 'parceiros') {
    const url = `${config.url}/rest/v1/rpc/gf_promocao_catalogo`;
    const res = await fetch(url, {
        method: 'POST',
        headers: hubHeaders(config, token),
        body: JSON.stringify({ p_canal: canal }),
    });
    const text = await res.text();
    if (!res.ok) {
        return { bySku: new Map(), byNome: new Map(), byId: new Map() };
    }

    const rows = text ? JSON.parse(text) : [];
    const list = Array.isArray(rows) ? rows : [];
    const bySku = new Map();
    const byNome = new Map();
    const byId = new Map();

    for (const row of list) {
        const meta = {
            validade_fim: String(row.validade_fim || '').slice(0, 10),
            unidade: String(row.unidade || '').trim().toUpperCase(),
            produto_id: String(row.produto_id || '').trim(),
        };
        const sku = String(row.sku || '').trim().toLowerCase();
        const id = meta.produto_id;
        const nome = normalizePromoLookupName(row.nome);
        if (sku) bySku.set(sku, meta);
        if (id) byId.set(id, meta);
        if (nome) byNome.set(nome, meta);
    }

    return { bySku, byNome, byId };
}

function resolvePromoMeta(row, maps) {
    const sku = String(row.produto_sku || '').trim().toLowerCase();
    const id = String(row.produto_id || '').trim();
    const nome = normalizePromoLookupName(row.produto_nome);

    if (id && maps.byId.has(id)) return maps.byId.get(id);
    if (sku && sku !== INDEFINIDO_SKU && maps.bySku.has(sku)) return maps.bySku.get(sku);
    if (nome && maps.byNome.has(nome)) return maps.byNome.get(nome);
    if (sku && maps.bySku.has(sku)) return maps.bySku.get(sku);
    return null;
}

export async function getHubPromocoes(env = process.env, { caixaOnly = false, canal = 'parceiros' } = {}) {
    const config = hubConfig(env);
    const token = config.serviceKey || config.anonKey;
    if (!config.url || !token) {
        throw new Error('Credenciais do Hub ausentes para carregar promoções.');
    }

    const today = todayIsoDate();
    const url = `${config.url}/rest/v1/rpc/rpc_listar_promocoes_vitrine`;
    const catalogCanal = caixaOnly ? 'totem' : canal;
    const [res, metaMaps] = await Promise.all([
        fetch(url, {
            method: 'POST',
            headers: hubHeaders(config, token),
            body: '{}',
        }),
        fetchPromoCatalogMetaMaps(config, token, catalogCanal),
    ]);
    const text = await res.text();
    if (!res.ok) {
        throw new Error(text || `rpc_listar_promocoes_vitrine HTTP ${res.status}`);
    }

    const rows = text ? JSON.parse(text) : [];
    const list = Array.isArray(rows) ? rows : [];

    let promocoes = list.map((row) => {
        const meta = resolvePromoMeta(row, metaMaps);
        return normalizePromoRow(row, meta);
    });

    if (caixaOnly) {
        promocoes = promocoes.filter((promo) => isCaixaPromoUnidade(promo.unidade));
    }

    return {
        source: caixaOnly
            ? 'hub:rpc_listar_promocoes_vitrine+caixa'
            : 'hub:rpc_listar_promocoes_vitrine',
        fetchedAt: new Date().toISOString(),
        date: today,
        promocoes,
    };
}

export async function getHubPromocoesTotem(env = process.env) {
    return getHubPromocoes(env, { caixaOnly: true, canal: 'totem' });
}
