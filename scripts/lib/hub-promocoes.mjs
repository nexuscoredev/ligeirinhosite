import { hubConfig } from '../hub-auth.mjs';
import { slugifyId } from './hub-catalog.mjs';

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

function normalizePromoRow(row, produto = null) {
    const original = Number(row.preco_original);
    const promo = Number(row.preco_promo);
    const discountPct =
        Number.isFinite(original) && original > 0 && Number.isFinite(promo)
            ? Math.max(0, Math.round((1 - promo / original) * 100))
            : 0;

    const nome = String(row.produto_nome || produto?.nome || '').trim();
    const rawImage = row.arte_url || produto?.imagem_url || null;
    const imageUrl = isDrivePromoImage(rawImage) ? produto?.imagem_url || null : rawImage;

    return {
        id: row.id,
        sku: String(row.produto_sku || '').trim(),
        hubProductId: row.produto_id ? String(row.produto_id).trim() : null,
        name: nome,
        originalPrice: Number.isFinite(original) ? original : null,
        promoPrice: Number.isFinite(promo) ? promo : null,
        discountPct,
        validFrom: String(row.validade_inicio || '').slice(0, 10),
        validTo: String(row.validade_fim || '').slice(0, 10),
        imageUrl,
        catalogProductId: nome ? slugifyId(nome) : produto?.nome ? slugifyId(produto.nome) : null,
        hubProductName: nome || (produto?.nome ? String(produto.nome).trim() : null),
        active: row.ativo !== false,
    };
}

async function fetchPromoCatalogValidadeMap(config, token) {
    const url = `${config.url}/rest/v1/rpc/gf_promocao_catalogo`;
    const res = await fetch(url, {
        method: 'POST',
        headers: hubHeaders(config, token),
        body: JSON.stringify({ p_canal: 'parceiros' }),
    });
    const text = await res.text();
    if (!res.ok) return new Map();

    const rows = text ? JSON.parse(text) : [];
    const list = Array.isArray(rows) ? rows : [];
    const map = new Map();

    for (const row of list) {
        const validade = String(row.validade_fim || '').slice(0, 10);
        if (!validade) continue;
        const sku = String(row.sku || '').trim().toLowerCase();
        const id = String(row.produto_id || '').trim();
        const nome = String(row.nome || '').trim().toLowerCase();
        if (sku) map.set(`sku:${sku}`, validade);
        if (id) map.set(`id:${id}`, validade);
        if (nome) map.set(`nome:${nome}`, validade);
    }

    return map;
}

function resolveValidadeFim(row, validadeMap) {
    const sku = String(row.produto_sku || '').trim().toLowerCase();
    const id = String(row.produto_id || '').trim();
    const nome = String(row.produto_nome || '').trim().toLowerCase();
    return (
        (sku && validadeMap.get(`sku:${sku}`)) ||
        (id && validadeMap.get(`id:${id}`)) ||
        (nome && validadeMap.get(`nome:${nome}`)) ||
        String(row.validade_fim || '').slice(0, 10)
    );
}

export async function getHubPromocoes(env = process.env) {
    const config = hubConfig(env);
    const token = config.serviceKey || config.anonKey;
    if (!config.url || !token) {
        throw new Error('Credenciais do Hub ausentes para carregar promoções.');
    }

    const today = todayIsoDate();
    const url = `${config.url}/rest/v1/rpc/rpc_listar_promocoes_vitrine`;
    const [res, validadeMap] = await Promise.all([
        fetch(url, {
            method: 'POST',
            headers: hubHeaders(config, token),
            body: '{}',
        }),
        fetchPromoCatalogValidadeMap(config, token),
    ]);
    const text = await res.text();
    if (!res.ok) {
        throw new Error(text || `rpc_listar_promocoes_vitrine HTTP ${res.status}`);
    }

    const rows = text ? JSON.parse(text) : [];
    const list = Array.isArray(rows) ? rows : [];

    return {
        source: 'hub:rpc_listar_promocoes_vitrine',
        fetchedAt: new Date().toISOString(),
        date: today,
        promocoes: list.map((row) => {
            const validTo = resolveValidadeFim(row, validadeMap);
            return normalizePromoRow({ ...row, validade_fim: validTo || row.validade_fim });
        }),
    };
}
