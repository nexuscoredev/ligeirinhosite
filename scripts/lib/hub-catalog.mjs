import { hubConfig } from '../hub-auth.mjs';

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

export function inferAdultOnly(categorySlug, name) {
    const slug = String(categorySlug || '').toLowerCase();
    if (ADULT_CATEGORY_SLUGS.has(slug)) {
        return !/\bC\/\d+\b/i.test(name);
    }
    return false;
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
        const slug = catInfo.slug || 'outros';
        if (!categoryMap.has(slug)) {
            const cat = categoryBySlug.get(slug);
            categoryMap.set(slug, {
                id: slug,
                name: (cat?.nome || catInfo.nome || slug).toUpperCase(),
                products: [],
            });
        }

        const price = Number(p.preco_base ?? p.preco_atacado ?? 0);

        categoryMap.get(slug).products.push({
            id: uniqueProductId(p),
            hubId: p.id,
            sku: String(p.sku || '').trim() || null,
            name: String(p.nome || '').trim().toUpperCase(),
            price: Number.isFinite(price) ? price : 0,
            priceLabel: formatPriceLabel(Number.isFinite(price) ? price : 0),
            description: p.descricao_resumida || null,
            adultOnly: inferAdultOnly(slug, p.nome),
            image: p.imagem_url || null,
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

    const [categorias, produtos] = await Promise.all([
        fetchAll(hub, 'categorias_produto', 'slug,nome,ordem_separacao', '', 'ordem_separacao.asc'),
        fetchAll(
            hub,
            'produtos',
            'id,nome,descricao_resumida,sku,preco_base,preco_atacado,imagem_url,categorias_produto(slug,nome)',
            '&ativo=eq.true&visivel_catalogo=eq.true'
        ),
    ]);

    if (produtos.length === 0) {
        throw new Error('Nenhum produto retornado do Hub.');
    }

    return { categorias, produtos };
}

export async function fetchCatalogFromHub(env = process.env, options = {}) {
    const config = hubConfig(env);
    const { categorias, produtos } = await fetchHubCatalogData(config);
    return buildCatalog(produtos, categorias, options);
}
