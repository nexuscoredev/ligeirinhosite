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
const config = hubConfig({
    HUB_SUPABASE_URL: hubEnv.NEXT_PUBLIC_SUPABASE_URL,
    HUB_SUPABASE_ANON_KEY: hubEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    HUB_SUPABASE_SERVICE_ROLE_KEY: hubEnv.SUPABASE_SERVICE_ROLE_KEY,
});

const norm = (u) => String(u || '').split('?')[0];

const { categorias, produtos, tabelaPadrao, priceMap } = await fetchHubCatalogData(config);
const catalog = buildCatalog(produtos, categorias, { tabelaPadrao, priceMap });

const cxDiff = [];
for (const p of produtos) {
    const pack = productImageForCatalog(p);
    const unOnly = p.imagem_url || null;
    if (pack && unOnly && norm(pack) !== norm(unOnly) && /\bCX\b|C\/\d+/i.test(p.nome)) {
        cxDiff.push({ nome: p.nome, cx: pack, un: unOnly });
    }
}

console.log('Produtos CX com imagem de caixa diferente da unidade:', cxDiff.length);
console.log('Exemplos:');
for (const row of cxDiff.slice(0, 8)) {
    console.log('-', row.nome);
    console.log('  caixa:', row.cx);
    console.log('  unidade (antiga):', row.un);
}

const samples = ['KERO COCO 1L', 'COCO QUADRADO 200ML', 'AGUA BIO 500 ML'];
for (const needle of samples) {
    const hit = produtos.find((p) => p.nome.includes(needle));
    if (!hit) continue;
    console.log('\n', hit.nome);
    console.log('  imagem correta (catalog):', productImageForCatalog(hit));
    console.log('  imagem_url (unidade):', hit.imagem_url);
    console.log('  imagem_cx_url:', hit.imagem_cx_url);
}
