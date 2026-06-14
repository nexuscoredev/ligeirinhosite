/**
 * Compara data/catalogo.json com produtos ativos/visíveis no Ligeirinho Hub.
 * Usa SUPABASE_SERVICE_ROLE_KEY de ../ligeirinhohub/.env.local (se existir).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(file) {
    const env = {};
    if (!fs.existsSync(file)) return env;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
    return env;
}

const hubEnv = loadEnv(path.resolve(__dirname, '../../ligeirinhohub/.env.local'));
const serviceKey = hubEnv.SUPABASE_SERVICE_ROLE_KEY;
const url = 'https://liszpwocwvkytzyaxvit.supabase.co';
const anonKey =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpc3pwd29jd3ZreXR6eWF4dml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjczNzUsImV4cCI6MjA5NTMwMzM3NX0.rMfpheVgAKQ4HelKB0ZoNDZXiU_3XQdv7ujLHxgdjEA';

if (!serviceKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY não encontrada em ligeirinhohub/.env.local');
    process.exit(1);
}

const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${serviceKey}`,
};

async function fetchAll(table, select, filters = '') {
    const rows = [];
    let from = 0;
    const PAGE = 1000;

    while (true) {
        const rangeEnd = from + PAGE - 1;
        const requestUrl =
            `${url}/rest/v1/${table}?select=${encodeURIComponent(select)}${filters}` +
            `&order=nome.asc&offset=${from}&limit=${PAGE}`;
        const res = await fetch(requestUrl, {
            headers: { ...headers, Range: `${from}-${rangeEnd}` },
        });
        const text = await res.text();
        if (!res.ok) throw new Error(`${table} ${res.status}: ${text}`);
        const batch = JSON.parse(text);
        rows.push(...batch);
        if (batch.length < PAGE) break;
        from += PAGE;
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

const localPath = path.join(__dirname, '..', 'data', 'catalogo.json');
const local = JSON.parse(fs.readFileSync(localPath, 'utf8'));
const localProducts = new Map();

for (const cat of local.categories) {
    for (const p of cat.products) {
        localProducts.set(p.id, { ...p, categoryId: cat.id });
    }
}

const produtos = await fetchAll(
    'produtos',
    'id,nome,descricao_resumida,sku,preco_base,preco_atacado,imagem_url,ativo,visivel_catalogo,categorias_produto(slug,nome)',
    '&ativo=eq.true&visivel_catalogo=eq.true'
);
const allProdutos = await fetchAll('produtos', 'id,ativo,visivel_catalogo', '');

console.log('=== Hub vs Parceiros ===');
console.log('Parceiros exportedAt:', local.exportedAt);
console.log('Parceiros produtos:', local.totalProducts);
console.log('Hub produtos (ativo + visivel_catalogo):', produtos.length);
console.log('Hub produtos total:', allProdutos.length);
console.log(
    'Hub inativos ou ocultos:',
    allProdutos.filter((p) => !p.ativo || !p.visivel_catalogo).length
);

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

const hubById = new Map();

for (const p of produtos) {
    const id = uniqueProductId(p);
    const price = Number(p.preco_base ?? p.preco_atacado ?? 0);
    hubById.set(id, {
        id,
        name: String(p.nome || '').trim().toUpperCase(),
        price: Number.isFinite(price) ? price : 0,
        slug: p.categorias_produto?.slug || 'outros',
    });
}

const onlyHub = [];
const onlyLocal = [];
const priceDiff = [];
const nameDiff = [];

for (const [id, hp] of hubById) {
    const lp = localProducts.get(id);
    if (!lp) {
        onlyHub.push(hp);
        continue;
    }
    if (Math.abs(lp.price - hp.price) > 0.001) {
        priceDiff.push({ id, local: lp.price, hub: hp.price, name: hp.name });
    }
    if (lp.name !== hp.name) {
        nameDiff.push({ id, local: lp.name, hub: hp.name });
    }
}

for (const [id, lp] of localProducts) {
    if (!hubById.has(id)) onlyLocal.push(lp);
}

console.log('IDs só no Hub:', onlyHub.length);
console.log('IDs só no Parceiros:', onlyLocal.length);
console.log('Diferenças de preço:', priceDiff.length);
console.log('Diferenças de nome:', nameDiff.length);

if (onlyHub.length) {
    console.log('Exemplos só Hub:', onlyHub.slice(0, 8).map((p) => p.name).join(' | '));
}
if (onlyLocal.length) {
    console.log('Exemplos só Parceiros:', onlyLocal.slice(0, 8).map((p) => p.name).join(' | '));
}
if (priceDiff.length) {
    console.log('Exemplos preço:', priceDiff.slice(0, 5));
}

const inSync =
    onlyHub.length === 0 &&
    onlyLocal.length === 0 &&
    priceDiff.length === 0 &&
    nameDiff.length === 0;

console.log(inSync ? '\n✓ Catálogo em sincronia com o Hub.' : '\n✗ Catálogo DESATUALIZADO em relação ao Hub.');
