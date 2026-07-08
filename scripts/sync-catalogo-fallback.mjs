/**
 * Atualiza data/catalogo.json a partir do Hub (service role).
 * Uso: node scripts/sync-catalogo-fallback.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { hubConfig } from './hub-auth.mjs';
import { fetchHubCatalogData, buildCatalog } from './lib/hub-catalog.mjs';

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
    HUB_SUPABASE_URL: process.env.HUB_SUPABASE_URL || hubEnv.NEXT_PUBLIC_SUPABASE_URL || hubEnv.HUB_SUPABASE_URL,
    HUB_SUPABASE_ANON_KEY:
        process.env.HUB_SUPABASE_ANON_KEY ||
        hubEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        hubEnv.HUB_SUPABASE_ANON_KEY,
    HUB_SUPABASE_SERVICE_ROLE_KEY:
        process.env.HUB_SUPABASE_SERVICE_ROLE_KEY ||
        hubEnv.SUPABASE_SERVICE_ROLE_KEY ||
        hubEnv.HUB_SUPABASE_SERVICE_ROLE_KEY,
};

async function main() {
    const config = hubConfig(env);
    if (!config.serviceKey) {
        throw new Error('HUB_SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_ROLE_KEY ausente.');
    }

    console.log('Buscando catálogo no Hub…');
    const { categorias, produtos, tabelaPadrao, priceMap } = await fetchHubCatalogData(config);
    console.log(`Encontrados: ${produtos.length} produtos, ${categorias.length} categorias.`);

    const catalog = buildCatalog(produtos, categorias, {
        syncMode: 'export',
        tabelaPadrao,
        priceMap,
    });
    const outPath = path.join(__dirname, '..', 'data', 'catalogo.json');
    fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2), 'utf8');
    console.log(`Salvo ${catalog.totalProducts} produtos em ${outPath}`);
    console.log('exportedAt:', catalog.exportedAt);
}

main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
});
