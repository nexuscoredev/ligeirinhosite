/**
 * Sincroniza data/catalogo.json a partir do Ligeirinho Hub (Supabase).
 *
 * Uso:
 *   HUB_LOGIN=Vinicius HUB_PASSWORD=*** node scripts/sync-catalogo-from-hub.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://liszpwocwvkytzyaxvit.supabase.co';
const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpc3pwd29jd3ZreXR6eWF4dml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjczNzUsImV4cCI6MjA5NTMwMzM3NX0.rMfpheVgAKQ4HelKB0ZoNDZXiU_3XQdv7ujLHxgdjEA';

const HUB_SOURCE = 'https://ligeirinhohub.vercel.app/admin/produtos';
const PAGE_SIZE = 1000;

const login = process.env.HUB_LOGIN || process.argv[2];
const password = process.env.HUB_PASSWORD || process.argv[3];

if (!login || !password) {
    console.error('Informe HUB_LOGIN e HUB_PASSWORD (env ou argumentos).');
    process.exit(1);
}

function supabaseHeaders(accessToken) {
    return {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
    };
}

async function rpc(name, body, accessToken) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: { ...supabaseHeaders(accessToken), Prefer: 'return=representation' },
        body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`RPC ${name} ${res.status}: ${text}`);
    if (!text) return null;
    return JSON.parse(text);
}

async function signIn() {
    const email = await rpc('resolve_login_email', { p_login: login });
    if (!email || typeof email !== 'string') {
        throw new Error(`Login "${login}" não encontrado no Hub.`);
    }

    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: supabaseHeaders(),
        body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error_description || data.msg || data.message || 'Falha no login');
    }
    return data.access_token;
}

async function fetchAll(table, select, accessToken, filters = '', order = 'nome.asc') {
    const rows = [];
    let from = 0;

    while (true) {
        const rangeEnd = from + PAGE_SIZE - 1;
        const url =
            `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}${filters}` +
            `&order=${order}&offset=${from}&limit=${PAGE_SIZE}`;
        const res = await fetch(url, {
            headers: {
                ...supabaseHeaders(accessToken),
                Range: `${from}-${rangeEnd}`,
                Prefer: 'count=exact',
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

function slugifyId(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function formatPriceLabel(price) {
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

function inferAdultOnly(categorySlug, name) {
    const slug = String(categorySlug || '').toLowerCase();
    if (ADULT_CATEGORY_SLUGS.has(slug)) {
        return !/\bC\/\d+\b/i.test(name);
    }
    return false;
}

function buildCatalog(produtos, categorias) {
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
        source: HUB_SOURCE,
        exportedAt: new Date().toISOString(),
        storeName: 'Ligeirinho Parceiros',
        totalProducts,
        imagesFound,
        categories,
    };
}

async function main() {
    console.log('Autenticando no Hub…');
    const token = await signIn();
    console.log('Login OK. Buscando categorias e produtos…');

    const categorias = await fetchAll(
        'categorias_produto',
        'slug,nome,ordem_separacao',
        token,
        '',
        'ordem_separacao.asc'
    );

    const produtos = await fetchAll(
        'produtos',
        'id,nome,descricao_resumida,sku,preco_base,preco_atacado,imagem_url,categorias_produto(slug,nome)',
        token,
        '&ativo=eq.true&visivel_catalogo=eq.true'
    );

    console.log(`Encontrados: ${produtos.length} produtos, ${categorias.length} categorias.`);

    if (produtos.length === 0) {
        throw new Error('Nenhum produto retornado — verifique permissões ou filtros.');
    }

    const catalog = buildCatalog(produtos, categorias);
    const outPath = path.join(__dirname, '..', 'data', 'catalogo.json');
    fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2), 'utf8');

    console.log(`Salvo ${catalog.totalProducts} produtos em ${outPath}`);
}

main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
});
