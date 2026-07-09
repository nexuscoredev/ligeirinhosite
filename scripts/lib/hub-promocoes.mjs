import { hubConfig } from '../hub-auth.mjs';
import { slugifyId } from './hub-catalog.mjs';
import { resolvePromoVitrinePrices } from './hub-promo-precos.mjs';

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

function normalizePromoRow(row, meta = null, produto = null, familyId = null) {
    const prices = resolvePromoVitrinePrices(row, meta);

    const nome = String(row.produto_nome || produto?.nome || '').trim();
    const rawImage = row.arte_url || produto?.imagem_url || null;
    const imageUrl = isDrivePromoImage(rawImage) ? produto?.imagem_url || null : rawImage;
    const hubProductId = meta?.produto_id || (row.produto_id ? String(row.produto_id).trim() : null);

    return {
        id: row.id,
        sku: String(row.produto_sku || '').trim(),
        hubProductId,
        hubFamilyId: familyId || hubProductId,
        name: nome,
        unidade: prices.unidade,
        fatorMultiplicacao: prices.fatorMultiplicacao,
        originalPrice: prices.originalPrice,
        promoPrice: prices.promoPrice,
        discountPct: prices.discountPct,
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
    const byNomePreco = new Map();

    for (const row of list) {
        const meta = {
            validade_fim: String(row.validade_fim || '').slice(0, 10),
            unidade: String(row.unidade || '').trim().toUpperCase(),
            produto_id: String(row.produto_id || '').trim(),
            preco_base: Number(row.preco_base),
            preco_promo: Number(row.preco_promo),
            fator_multiplicacao: Number(row.fator_multiplicacao),
        };
        const sku = String(row.sku || '').trim().toLowerCase();
        const id = meta.produto_id;
        const nome = normalizePromoLookupName(row.nome);
        if (sku) bySku.set(sku, meta);
        if (id) byId.set(id, meta);
        if (nome) {
            byNome.set(nome, meta);
            if (Number.isFinite(meta.preco_promo)) {
                byNomePreco.set(`${nome}::${meta.preco_promo.toFixed(2)}`, meta);
            }
        }
    }

    return { bySku, byNome, byId, byNomePreco };
}

async function fetchProdutoFamilyMap(config, token, productIds = []) {
    const ids = [...new Set(productIds.filter(Boolean))];
    if (!ids.length || !config.serviceKey) return new Map();

    const map = new Map();
    for (let i = 0; i < ids.length; i += 80) {
        const chunk = ids.slice(i, i + 80);
        const res = await fetch(
            `${config.url}/rest/v1/produtos?select=id,produto_base_id&id=in.(${chunk.join(',')})`,
            { headers: hubHeaders(config, token) },
        );
        const text = await res.text();
        if (!res.ok) continue;
        const rows = text ? JSON.parse(text) : [];
        for (const row of rows || []) {
            const id = String(row.id || '').trim();
            const base = String(row.produto_base_id || '').trim();
            map.set(id, base && base !== id ? base : id);
        }
    }
    return map;
}

function resolvePromoMeta(row, maps) {
    const sku = String(row.produto_sku || '').trim().toLowerCase();
    const id = String(row.produto_id || '').trim();
    const nome = normalizePromoLookupName(row.produto_nome);
    const precoPromo = Number(row.preco_promo);

    if (id && maps.byId.has(id)) return maps.byId.get(id);
    if (sku && sku !== INDEFINIDO_SKU && maps.bySku.has(sku)) return maps.bySku.get(sku);
    if (nome && Number.isFinite(precoPromo)) {
        const key = `${nome}::${precoPromo.toFixed(2)}`;
        if (maps.byNomePreco?.has(key)) return maps.byNomePreco.get(key);
    }
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

    const productIds = list
        .map((row) => {
            const meta = resolvePromoMeta(row, metaMaps);
            return meta?.produto_id || row.produto_id || null;
        })
        .filter(Boolean);
    const familyMap = await fetchProdutoFamilyMap(config, token, productIds);

    let promocoes = list.map((row) => {
        const meta = resolvePromoMeta(row, metaMaps);
        const hubProductId = meta?.produto_id || (row.produto_id ? String(row.produto_id).trim() : null);
        const familyId = hubProductId ? familyMap.get(hubProductId) || hubProductId : null;
        return normalizePromoRow(row, meta, null, familyId);
    });

    if (caixaOnly) {
        promocoes = promocoes.filter((promo) => isCaixaPromoUnidade(promo.unidade));
    }

    return {
        source: caixaOnly
            ? 'hub:rpc_listar_promocoes_vitrine+caixa'
            : canal === 'totem'
              ? 'hub:rpc_listar_promocoes_vitrine+totem'
              : 'hub:rpc_listar_promocoes_vitrine',
        fetchedAt: new Date().toISOString(),
        date: today,
        promocoes,
    };
}

export async function getHubPromocoesTotem(env = process.env) {
    return getHubPromocoes(env, { caixaOnly: false, canal: 'totem' });
}
