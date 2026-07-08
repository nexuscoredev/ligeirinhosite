/**
 * Compara imagens do catálogo publicado com o Hub (produtos CX ativos).
 * Uso: node scripts/verify-totem-images.mjs [--base https://ligeirinhoparceiros.vercel.app]
 */
import { fetchCatalogFromHub, productImageForCatalog } from './lib/hub-catalog.mjs';
import { hubConfig } from './hub-auth.mjs';

const BASE = process.argv.includes('--base')
    ? process.argv[process.argv.indexOf('--base') + 1]
    : process.env.APP_BASE_URL || 'https://ligeirinhoparceiros.vercel.app';

function normalizeImageUrl(url) {
    if (!url) return '';
    return String(url).split('?')[0].replace(/\.webp$/i, '');
}

async function fetchPublishedCatalog() {
    const res = await fetch(`${BASE}/api/totem/catalog`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`API totem/catalog HTTP ${res.status}`);
    return res.json();
}

async function main() {
    const config = hubConfig(process.env);
    if (!config.serviceKey && !config.accessToken) {
        console.error('Defina HUB_SUPABASE_SERVICE_ROLE_KEY para comparar com o Hub.');
        process.exit(1);
    }

    const [published, hubCatalog] = await Promise.all([
        fetchPublishedCatalog(),
        fetchCatalogFromHub(process.env, { syncMode: 'live' }),
    ]);

    const hubById = new Map();
    for (const cat of hubCatalog.categories || []) {
        for (const product of cat.products || []) {
            if (product.hubId) hubById.set(product.hubId, product);
        }
    }

    const publishedProducts = (published.categories || []).flatMap((c) => c.products || []);
    let mismatches = 0;
    let checked = 0;
    const samples = [];

    for (const product of publishedProducts) {
        if (String(product.unidade || '').toUpperCase() !== 'CX') continue;
        const hub = hubById.get(product.hubId);
        if (!hub) continue;
        checked += 1;
        const pubImg = normalizeImageUrl(product.image);
        const hubImg = normalizeImageUrl(hub.image);
        if (pubImg !== hubImg) {
            mismatches += 1;
            if (samples.length < 12) {
                samples.push({
                    name: product.name,
                    hubId: product.hubId,
                    published: product.image,
                    hub: hub.image,
                });
            }
        }
    }

    console.log('Base publicada:', BASE);
    console.log('Exportado em:', published.exportedAt);
    console.log('Produtos CX comparados:', checked);
    console.log('Imagens divergentes:', mismatches);
    if (samples.length) {
        console.log('\nExemplos:');
        for (const row of samples) {
            console.log(`- ${row.name}`);
            console.log(`  publicado: ${row.published}`);
            console.log(`  hub:       ${row.hub}`);
        }
    }

    process.exit(mismatches > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error(err.message || err);
    process.exit(2);
});
