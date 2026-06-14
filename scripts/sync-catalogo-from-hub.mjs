/**
 * Sincroniza data/catalogo.json a partir do Ligeirinho Hub (Supabase).
 * Uso manual / backup — o app usa /api/catalog em produção.
 *
 *   HUB_LOGIN=Vinicius HUB_PASSWORD=*** node scripts/sync-catalogo-from-hub.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { hubConfig, resolveHubLogin } from './hub-auth.mjs';
import { fetchHubCatalogData, buildCatalog } from './lib/hub-catalog.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const login = process.env.HUB_LOGIN || process.argv[2];
const password = process.env.HUB_PASSWORD || process.argv[3];

if (!login || !password) {
    console.error('Informe HUB_LOGIN e HUB_PASSWORD (env ou argumentos).');
    process.exit(1);
}

async function main() {
    console.log('Autenticando no Hub…');
    const config = hubConfig(process.env);
    const auth = await resolveHubLogin(config, login, password);
    if (auth.error) throw new Error(auth.error);

    console.log('Login OK. Buscando categorias e produtos…');
    const { categorias, produtos } = await fetchHubCatalogData({
        ...config,
        accessToken: auth.accessToken,
    });

    console.log(`Encontrados: ${produtos.length} produtos, ${categorias.length} categorias.`);

    const catalog = buildCatalog(produtos, categorias, { syncMode: 'export' });
    const outPath = path.join(__dirname, '..', 'data', 'catalogo.json');
    fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2), 'utf8');

    console.log(`Salvo ${catalog.totalProducts} produtos em ${outPath}`);
}

main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
});
