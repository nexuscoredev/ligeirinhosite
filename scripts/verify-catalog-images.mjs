/**
 * Compara imagens do catálogo ao vivo (Parceiros/Totem) com imagem_url do Hub.
 * Uso: node scripts/verify-catalog-images.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { hubConfig } from './hub-auth.mjs';
import { buildCatalog, fetchHubCatalogData, productImageForCatalog } from './lib/hub-catalog.mjs';

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
const env = {
    ...process.env,
    HUB_SUPABASE_URL: process.env.HUB_SUPABASE_URL || hubEnv.NEXT_PUBLIC_SUPABASE_URL,
    HUB_SUPABASE_ANON_KEY: process.env.HUB_SUPABASE_ANON_KEY || hubEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    HUB_SUPABASE_SERVICE_ROLE_KEY:
        process.env.HUB_SUPABASE_SERVICE_ROLE_KEY || hubEnv.SUPABASE_SERVICE_ROLE_KEY,
};

const LIVE_URL = process.env.CATALOG_LIVE_URL || 'https://ligeirinhoparceiros.vercel.app/api/catalog';

const normalizeImageUrl = (url) => {
    const raw = String(url || '').trim();
    if (!raw) return '';
    try {
        const u = new URL(raw, 'https://ligeirinhoparceiros.vercel.app');
        u.search = '';
        return u.href.replace(/\/$/, '');
    } catch {
        return raw.split('?')[0].replace(/\/$/, '');
    }
};

const CX_RE = /\b(CX\s*\/?\s*\d+|CX\s+\d+|C\/\s*\d+)\b/i;

function isCaixaName(name) {
    return CX_RE.test(String(name || ''));
}

function flattenCatalog(catalog) {
    const items = [];
    for (const cat of catalog.categories || []) {
        for (const p of cat.products || []) {
            items.push({ ...p, categoryId: cat.id });
        }
    }
    return items;
}

async function fetchLiveCatalog() {
    const res = await fetch(LIVE_URL, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Live catalog ${res.status}: ${await res.text()}`);
    return res.json();
}

async function main() {
    const config = hubConfig(env);
    if (!config.serviceKey) {
        console.error('Service role key ausente.');
        process.exit(1);
    }

    const [{ categorias, produtos, tabelaPadrao, priceMap }, liveCatalog, localCatalog] =
        await Promise.all([
        fetchHubCatalogData(config),
        fetchLiveCatalog(),
        Promise.resolve(
            JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'catalogo.json'), 'utf8'))
        ),
    ]);

    const builtCatalog = buildCatalog(produtos, categorias, {
        syncMode: 'live',
        tabelaPadrao,
        priceMap,
    });
    const hubById = new Map(produtos.map((p) => [p.id, p]));
    const builtProducts = flattenCatalog(builtCatalog);
    const liveProducts = flattenCatalog(liveCatalog);
    const localProducts = flattenCatalog(localCatalog);

    const liveByHub = new Map(liveProducts.filter((p) => p.hubId).map((p) => [p.hubId, p]));
    const builtByHub = new Map(builtProducts.filter((p) => p.hubId).map((p) => [p.hubId, p]));
    const localByHub = new Map(localProducts.filter((p) => p.hubId).map((p) => [p.hubId, p]));

    const hubMissingImage = [];
    const liveMissingImage = [];
    const liveVsHubMismatch = [];
    const builtVsHubMismatch = [];
    const localVsHubMismatch = [];
    const localVsLiveMismatch = [];

    for (const hub of produtos) {
        const hubImg = normalizeImageUrl(productImageForCatalog(hub));
        if (!hubImg) hubMissingImage.push(hub.nome);

        const live = liveByHub.get(hub.id);
        const built = builtByHub.get(hub.id);
        const local = localByHub.get(hub.id);

        if (live && !normalizeImageUrl(live.image)) liveMissingImage.push(live.name);
        if (live && hubImg && normalizeImageUrl(live.image) !== hubImg) {
            liveVsHubMismatch.push({
                name: hub.nome,
                hub: hubImg,
                live: normalizeImageUrl(live.image),
            });
        }
        if (built && hubImg && normalizeImageUrl(built.image) !== hubImg) {
            builtVsHubMismatch.push({
                name: hub.nome,
                hub: hubImg,
                built: normalizeImageUrl(built.image),
            });
        }
        if (local && hubImg && normalizeImageUrl(local.image) !== hubImg) {
            localVsHubMismatch.push({
                name: hub.nome,
                hub: hubImg,
                local: normalizeImageUrl(local.image),
            });
        }
        if (local && live && normalizeImageUrl(local.image) !== normalizeImageUrl(live.image)) {
            localVsLiveMismatch.push(local.name);
        }
    }

    const cxHub = produtos.filter((p) => isCaixaName(p.nome));
    const cxLive = liveProducts.filter((p) => isCaixaName(p.name));
    const cxHubNoImg = cxHub.filter((p) => !normalizeImageUrl(productImageForCatalog(p)));
    const cxLiveNoImg = cxLive.filter((p) => !normalizeImageUrl(p.image));

    console.log('=== Imagens: Hub vs Parceiros/Totem ===');
    console.log('Hub produtos (ativo + visível):', produtos.length);
    console.log('Live /api/catalog produtos:', liveProducts.length);
    console.log('Fallback catalogo.json produtos:', localProducts.length);
    console.log('');
    console.log('Hub sem imagem_url:', hubMissingImage.length);
    console.log('Live sem image:', liveMissingImage.length);
    console.log('Live vs Hub (URL diferente):', liveVsHubMismatch.length);
    console.log('Build local vs Hub (URL diferente):', builtVsHubMismatch.length);
    console.log('Fallback vs Hub (URL diferente):', localVsHubMismatch.length);
    console.log('Fallback vs Live (URL diferente):', localVsLiveMismatch.length);
    console.log('');
    console.log('Produtos CX no Hub:', cxHub.length);
    console.log('Produtos CX no live:', cxLive.length);
    console.log('CX Hub sem imagem:', cxHubNoImg.length);
    console.log('CX live sem imagem:', cxLiveNoImg.length);

    if (hubMissingImage.length) {
        console.log('\nExemplos Hub sem imagem:', hubMissingImage.slice(0, 5).join(' | '));
    }
    if (liveVsHubMismatch.length) {
        console.log('\nExemplos live ≠ Hub:', liveVsHubMismatch.slice(0, 3));
    }
    if (localVsHubMismatch.length) {
        console.log('\nExemplos fallback ≠ Hub:', localVsHubMismatch.slice(0, 3));
    }
    if (localVsLiveMismatch.length) {
        console.log('\nFallback desatualizado (≠ live):', localVsLiveMismatch.length, 'produtos');
        console.log('Exemplos:', localVsLiveMismatch.slice(0, 5).join(' | '));
    }

    const ok =
        liveVsHubMismatch.length === 0 &&
        builtVsHubMismatch.length === 0 &&
        liveMissingImage.length === 0;

    console.log(
        ok
            ? '\n✓ Imagens do catálogo ao vivo batem com o Hub (Parceiros e Totem usam /api/catalog).'
            : '\n✗ Há divergências de imagem entre live e Hub.'
    );

    if (localVsLiveMismatch.length > 0) {
        console.log('⚠ Fallback data/catalogo.json está desatualizado — rode: node scripts/sync-catalogo-fallback.mjs');
    }

    process.exit(ok ? 0 : 2);
}

main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
});
