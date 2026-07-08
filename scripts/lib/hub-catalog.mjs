import { hubConfig } from '../hub-auth.mjs';
import {
    fatorEmbalagemValido,
    precoEmbalagem,
    unidadeUsaPrecoEmbalagem,
} from './hub-promo-precos.mjs';

export const HUB_SOURCE = 'https://ligeirinhohub.vercel.app/admin/produtos';
export const PAGE_SIZE = 1000;

function supabaseHeaders(anonKey, token) {
    return {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
}

async function fetchAll(config, table, select, filters = '', order = 'nome.asc') {
    const rows = [];
    let from = 0;

    while (true) {
        const rangeEnd = from + PAGE_SIZE - 1;
        const url =
            `${config.url}/rest/v1/${table}?select=${encodeURIComponent(select)}${filters}` +
            `&order=${order}&offset=${from}&limit=${PAGE_SIZE}`;
        const res = await fetch(url, {
            headers: {
                ...supabaseHeaders(config.anonKey, config.token),
                Range: `${from}-${rangeEnd}`,
            },
        });
        const text = await res.text();
        if (!res.ok) throw new Error(`${table} ${res.status}: ${text}`);
        const batch = JSON.parse(text);
        rows.push(...batch);
        if (batch.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
    }

    return rows;
}

export function slugifyId(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function formatPriceLabel(price) {
    return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const ADULT_CATEGORY_SLUGS = new Set([
    'cerveja',
    'cervejas',
    'destilados',
    'licores',
    'whisky',
    'whiskys',
    'vodka',
    'vodkas',
    'gin',
    'gin-s',
    'vinhos',
    'vinho',
    'espumantes',
]);

const SNACK_CATEGORY_SLUGS = new Set(['salgadinho', 'salgadinhos']);

/** Evita licores cadastrados na categoria errada no Hub (ex.: Salgadinhos). */
export function resolveProductCategorySlug(catInfo, productName) {
    const slug = catInfo?.slug || 'outros';
    const name = String(productName || '').trim().toUpperCase();
    if (SNACK_CATEGORY_SLUGS.has(slug) && /^LICOR\s/.test(name)) {
        return 'licores';
    }
    return slug;
}

export function inferAdultOnly(categorySlug, name) {
    const slug = String(categorySlug || '').toLowerCase();
    if (ADULT_CATEGORY_SLUGS.has(slug)) {
        return !/\bC\/\d+\b/i.test(name);
    }
    return false;
}

function normalizarUnidadeProduto(unidade) {
    const raw = String(unidade || 'UN').trim().toUpperCase();
    if (['PC', 'FARDO', 'FD', 'CX'].includes(raw)) return 'CX';
    if (['PLT', 'PL', 'PALLET'].includes(raw)) return 'PL';
    return 'UN';
}

function inferPackType(nome, unidade) {
    const u = normalizarUnidadeProduto(unidade);
    if (u === 'CX' || u === 'PL') return u;
    const name = String(nome || '').toUpperCase();
    if (/\bPL\b|PALLET/.test(name)) return 'PL';
    if (/\bCX\b|\bC\/\s*\d+/.test(name)) return 'CX';
    return 'UN';
}

/** Mesma regra do Hub (`imagemCatalogoUrl`): extensão e cache-bust em URLs do storage. */
export function imagemCatalogoUrl(url, cacheBust) {
    if (!url) return null;
    if (url.startsWith('/')) return url;

    let normalized = String(url).trim();
    if (!/\.(webp|jpg|jpeg|png|gif|svg)(\?|$)/i.test(normalized)) {
        normalized = `${normalized}.webp`;
    }

    if (cacheBust && normalized.includes('supabase.co')) {
        const base = normalized.split('?')[0];
        const ts =
            typeof cacheBust === 'number'
                ? cacheBust
                : new Date(String(cacheBust)).getTime();
        if (Number.isFinite(ts) && ts > 0) return `${base}?v=${ts}`;
    }

    return normalized;
}

/** Mesma regra do Hub: foto por unidade de venda (`imagemProdutoPorUnidade`). */
function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
}

function isTabelaItemVigente(item, today = todayIsoDate()) {
    const inicio = String(item.validade_inicio || '1970-01-01').slice(0, 10);
    const fim = String(item.validade_fim || '2099-12-31').slice(0, 10);
    return today >= inicio && today <= fim;
}

function aplicarPercentualTabela(precoBase, modo, percentual) {
    const pct = Number(percentual);
    const base = Number(precoBase);
    if (!Number.isFinite(base) || !Number.isFinite(pct)) return base;
    const fator = pct / 100;
    const ajustado =
        modo === 'desconto' ? base * (1 - fator) : base * (1 + fator);
    return Math.round(ajustado * 100) / 100;
}

/**
 * Preço de vitrine alinhado ao Hub: tabela PADRAO (unitário) + embalagem, ou preco_base.
 * @param {object} produto
 * @param {Map<string, number> | null | undefined} priceMap produto_id → preço unitário na tabela
 * @param {{ aplicacao?: string, modo?: string, percentual?: number } | null | undefined} tabelaPadrao
 */
export function resolveCatalogPrice(produto, priceMap, tabelaPadrao) {
    const precoBaseEmb = Number(produto.preco_base ?? produto.preco_atacado ?? 0);

    if (tabelaPadrao?.aplicacao === 'todos_produtos') {
        return aplicarPercentualTabela(
            precoBaseEmb,
            tabelaPadrao.modo,
            tabelaPadrao.percentual,
        );
    }

    const precoUnitario = priceMap?.get(produto.id);
    if (precoUnitario != null && Number.isFinite(Number(precoUnitario))) {
        const unidade = normalizarUnidadeProduto(produto.unidade);
        const fator = fatorEmbalagemValido(produto.fator_multiplicacao);
        if (unidadeUsaPrecoEmbalagem(unidade, fator)) {
            return precoEmbalagem(Number(precoUnitario), fator);
        }
        return Number(precoUnitario);
    }

    return Number.isFinite(precoBaseEmb) ? precoBaseEmb : 0;
}

async function fetchTabelaPrecoPadrao(hub) {
    let tabelas = await fetchAll(
        hub,
        'tabelas_preco',
        'id,codigo,padrao,ativo,aplicacao,modo,percentual',
        '&ativo=eq.true&padrao=eq.true',
        'codigo.asc',
    );
    if (!tabelas.length) {
        tabelas = await fetchAll(
            hub,
            'tabelas_preco',
            'id,codigo,padrao,ativo,aplicacao,modo,percentual',
            '&ativo=eq.true&codigo=eq.PADRAO',
            'codigo.asc',
        );
    }
    return tabelas[0] || null;
}

async function fetchTabelaPrecoItensMap(hub, tabelaId) {
    const items = await fetchAll(
        hub,
        'tabelas_preco_itens',
        'produto_id,preco,ativo,validade_inicio,validade_fim',
        `&tabela_preco_id=eq.${tabelaId}&ativo=eq.true`,
        'created_at.asc',
    );
    const today = todayIsoDate();
    const map = new Map();
    for (const item of items) {
        if (!isTabelaItemVigente(item, today)) continue;
        const preco = Number(item.preco);
        if (Number.isFinite(preco)) map.set(item.produto_id, preco);
    }
    return map;
}

export function productImageForCatalog(produto) {
    const u = normalizarUnidadeProduto(produto?.unidade);
    let raw = null;
    if (u === 'CX') raw = produto?.imagem_cx_url ?? produto?.imagem_url;
    else if (u === 'PL') raw = produto?.imagem_pl_url ?? produto?.imagem_url;
    else raw = produto?.imagem_url;

    const cacheBust =
        produto?.updated_at ||
        produto?.imagem_atualizada_em ||
        null;

    return imagemCatalogoUrl(raw, cacheBust);
}

export function buildCatalog(produtos, categorias, options = {}) {
    const categoryBySlug = new Map(categorias.map((c) => [c.slug, c]));
    const categoryMap = new Map();
    const usedIds = new Set();

    function uniqueProductId(p) {
        let base = slugifyId(p.nome) || slugifyId(p.sku) || String(p.id).slice(0, 8);
        let id = base;
        let n = 2;
        while (usedIds.has(id)) {
            id = `${base}-${n++}`;
        }
        usedIds.add(id);
        return id;
    }

    for (const p of produtos) {
        const catInfo = p.categorias_produto || {};
        const slug = resolveProductCategorySlug(catInfo, p.nome);
        if (!categoryMap.has(slug)) {
            const cat = categoryBySlug.get(slug);
            categoryMap.set(slug, {
                id: slug,
                name: (cat?.nome || catInfo.nome || slug).toUpperCase(),
                products: [],
            });
        }

        const price = resolveCatalogPrice(
            p,
            options.priceMap,
            options.tabelaPadrao,
        );
        const unidade = normalizarUnidadeProduto(p.unidade);
        const fatorRaw = Number(p.fator_multiplicacao);
        const fatorMultiplicacao =
            Number.isFinite(fatorRaw) && fatorRaw > 0 ? fatorRaw : null;

        categoryMap.get(slug).products.push({
            id: uniqueProductId(p),
            hubId: p.id,
            sku: String(p.sku || '').trim() || null,
            name: String(p.nome || '').trim().toUpperCase(),
            /** Unidade canônica do Hub (UN/CX/PL) — Totem/Parceiros usam isso, não só o sufixo do nome. */
            unidade,
            fatorMultiplicacao,
            price: Number.isFinite(price) ? price : 0,
            priceLabel: formatPriceLabel(Number.isFinite(price) ? price : 0),
            description: p.descricao_resumida || null,
            adultOnly: inferAdultOnly(slug, p.nome),
            image: productImageForCatalog(p),
            vendaParceiros: p.venda_parceiros !== false,
        });
    }

    const orderBySlug = new Map(categorias.map((c, i) => [c.slug, c.ordem_separacao ?? i]));
    const categories = [...categoryMap.values()]
        .filter((c) => c.products.length > 0)
        .sort(
            (a, b) =>
                (orderBySlug.get(a.id) ?? 999) - (orderBySlug.get(b.id) ?? 999) ||
                a.name.localeCompare(b.name, 'pt-BR')
        );

    for (const cat of categories) {
        cat.products.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }

    const totalProducts = categories.reduce((n, c) => n + c.products.length, 0);
    const imagesFound = categories.reduce(
        (n, c) => n + c.products.filter((p) => p.image).length,
        0
    );

    return {
        source: options.source || HUB_SOURCE,
        exportedAt: new Date().toISOString(),
        storeName: options.storeName || 'Ligeirinho Parceiros',
        syncMode: options.syncMode || 'live',
        totalProducts,
        imagesFound,
        categories,
    };
}

/** Índice catálogo Parceiros (slug/sku/uuid) → produto Hub — mesma ordem que buildCatalog. */
export function buildHubProductLookup(produtos) {
    const map = new Map();
    const usedIds = new Set();

    function uniqueProductId(p) {
        let base = slugifyId(p.nome) || slugifyId(p.sku) || String(p.id).slice(0, 8);
        let id = base;
        let n = 2;
        while (usedIds.has(id)) {
            id = `${base}-${n++}`;
        }
        usedIds.add(id);
        return id;
    }

    for (const p of produtos) {
        const catalogId = uniqueProductId(p);
        const row = {
            id: p.id,
            sku: String(p.sku || '').trim() || null,
            ean: String(p.ean || '').trim() || null,
            nome: p.nome,
            categorias_produto: p.categorias_produto,
        };
        if (row.id) map.set(String(row.id), row);
        if (row.sku) map.set(row.sku, row);
        if (row.ean) map.set(row.ean, row);
        if (catalogId) map.set(catalogId, row);
        const nameKey = String(p.nome || '').trim().toUpperCase();
        if (nameKey.length >= 4 && !map.has(nameKey)) map.set(nameKey, row);
    }

    return map;
}

export async function fetchHubProdutosForLookup(config) {
    const token = config.serviceKey || config.accessToken;
    if (!token) {
        throw new Error('Credenciais do Hub ausentes (service role ou access token).');
    }

    const hub = {
        url: config.url,
        anonKey: config.anonKey,
        token,
    };

    return fetchAll(
        hub,
        'produtos',
        'id,nome,sku,ean,categorias_produto(ordem_separacao)',
        '&ativo=eq.true'
    );
}

export async function fetchHubCatalogData(config) {
    const token = config.serviceKey || config.accessToken;
    if (!token) {
        throw new Error('Credenciais do Hub ausentes (service role ou access token).');
    }

    const hub = {
        url: config.url,
        anonKey: config.anonKey,
        token,
    };

    const [categorias, produtos, tabelaPadrao] = await Promise.all([
        fetchAll(hub, 'categorias_produto', 'slug,nome,ordem_separacao', '', 'ordem_separacao.asc'),
        fetchAll(
            hub,
            'produtos',
            'id,nome,descricao_resumida,sku,preco_base,preco_atacado,unidade,fator_multiplicacao,imagem_url,imagem_cx_url,imagem_pl_url,venda_parceiros,updated_at,categorias_produto(slug,nome)',
            '&ativo=eq.true&visivel_catalogo=eq.true&venda_parceiros=eq.true'
        ),
        fetchTabelaPrecoPadrao(hub),
    ]);

    if (produtos.length === 0) {
        throw new Error('Nenhum produto retornado do Hub.');
    }

    let priceMap = null;
    if (tabelaPadrao?.id && tabelaPadrao.aplicacao !== 'todos_produtos') {
        priceMap = await fetchTabelaPrecoItensMap(hub, tabelaPadrao.id);
    }

    return { categorias, produtos, tabelaPadrao, priceMap };
}

export async function fetchCatalogFromHub(env = process.env, options = {}) {
    const config = hubConfig(env);
    const { categorias, produtos, tabelaPadrao, priceMap } =
        await fetchHubCatalogData(config);
    return buildCatalog(produtos, categorias, {
        ...options,
        tabelaPadrao,
        priceMap,
    });
}
