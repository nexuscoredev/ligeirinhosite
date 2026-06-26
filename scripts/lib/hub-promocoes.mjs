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

function normalizePromoRow(row, produto = null) {
    const original = Number(row.preco_original);
    const promo = Number(row.preco_promo);
    const discountPct =
        Number.isFinite(original) && original > 0 && Number.isFinite(promo)
            ? Math.max(0, Math.round((1 - promo / original) * 100))
            : 0;

    return {
        id: row.id,
        sku: String(row.produto_sku || '').trim(),
        name: String(row.produto_nome || produto?.nome || '').trim(),
        originalPrice: Number.isFinite(original) ? original : null,
        promoPrice: Number.isFinite(promo) ? promo : null,
        discountPct,
        validFrom: String(row.validade_inicio || '').slice(0, 10),
        validTo: String(row.validade_fim || '').slice(0, 10),
        imageUrl: row.arte_url || produto?.imagem_url || null,
        catalogProductId: produto?.nome ? slugifyId(produto.nome) : null,
        hubProductName: produto?.nome ? String(produto.nome).trim() : null,
        active: row.ativo !== false,
    };
}

async function fetchProdutosBySku(config, token, skus) {
    const map = new Map();
    const unique = [...new Set(skus.map((s) => String(s || '').trim()).filter(Boolean))];
    if (!unique.length) return map;

    const quoted = unique.map((s) => `"${s.replace(/"/g, '')}"`).join(',');
    const url =
        `${config.url}/rest/v1/produtos?select=sku,nome,imagem_url` +
        `&sku=in.(${quoted})&ativo=eq.true&limit=${unique.length}`;
    const res = await fetch(url, { headers: hubHeaders(config, token) });
    if (!res.ok) return map;
    const rows = await res.json().catch(() => []);
    if (!Array.isArray(rows)) return map;
    rows.forEach((row) => {
        if (row?.sku) map.set(String(row.sku).trim(), row);
    });
    return map;
}

export async function getHubPromocoes(env = process.env) {
    const config = hubConfig(env);
    const token = config.serviceKey || config.anonKey;
    if (!config.url || !token) {
        throw new Error('Credenciais do Hub ausentes para carregar promoções.');
    }

    const today = todayIsoDate();
    const url =
        `${config.url}/rest/v1/promocoes?select=*` +
        `&ativo=eq.true&validade_inicio=lte.${today}&validade_fim=gte.${today}` +
        `&order=validade_fim.asc`;

    const res = await fetch(url, { headers: hubHeaders(config, token) });
    const text = await res.text();
    if (!res.ok) {
        throw new Error(text || `promocoes HTTP ${res.status}`);
    }

    const rows = text ? JSON.parse(text) : [];
    const list = Array.isArray(rows) ? rows : [];
    const produtos = await fetchProdutosBySku(
        config,
        token,
        list.map((row) => row.produto_sku)
    );

    return {
        source: 'hub:promocoes',
        fetchedAt: new Date().toISOString(),
        date: today,
        promocoes: list.map((row) => normalizePromoRow(row, produtos.get(String(row.produto_sku || '').trim()))),
    };
}
