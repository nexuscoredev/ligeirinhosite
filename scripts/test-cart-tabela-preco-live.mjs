/**
 * Teste integrado: troca de tabela + re-adicionar com preços reais do Hub.
 * Uso: node scripts/test-cart-tabela-preco-live.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { hubConfig } from './hub-auth.mjs';
import {
    fetchCatalogFromHub,
    fetchHubCatalogData,
    listActivePriceTables,
} from './lib/hub-catalog.mjs';
import {
    buildCatalogPriceLookup,
    simulateAddProduct,
    simulateApplyOrderPriceTable,
    simulateRemoveProduct,
} from './lib/cart-add-price.mjs';

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

function flatProducts(catalog) {
    const out = [];
    for (const cat of catalog?.categories || []) {
        for (const p of cat.products || []) {
            if (p.unidade === 'PL') continue;
            out.push(p);
        }
    }
    return out;
}

function pickSample(padraoCatalog, tableCatalog) {
    const padraoMap = buildCatalogPriceLookup(padraoCatalog);
    const tableMap = buildCatalogPriceLookup(tableCatalog);
    for (const p of flatProducts(padraoCatalog)) {
        const pad = padraoMap.get(String(p.id));
        const tab = tableMap.get(String(p.id));
        if (pad != null && tab != null && Math.abs(pad - tab) >= 0.05) {
            return {
                key: `${p.id}::caixa`,
                id: p.id,
                hubId: p.hubId || '',
                name: p.name,
                padraoPrice: pad,
                tablePrice: tab,
            };
        }
    }
    return null;
}

async function main() {
    const config = hubConfig(env);
    if (!config.serviceKey) {
        console.error('HUB_SUPABASE_SERVICE_ROLE_KEY ausente.');
        process.exit(1);
    }

    const hub = { url: config.url, anonKey: config.anonKey, token: config.serviceKey };
    const tabelas = await listActivePriceTables(hub);
    const tabela1 = tabelas.find((t) => t.codigo === 'TABELA 1%');
    if (!tabela1) {
        console.error('Tabela TABELA 1% não encontrada.');
        process.exit(1);
    }

    const padraoCatalog = await fetchCatalogFromHub(env, { channel: 'parceiros', syncMode: 'live' });
    const tableCatalog = await fetchCatalogFromHub(env, {
        channel: 'parceiros',
        syncMode: 'live',
        tabelaPrecoId: tabela1.id,
    });

    const sample = pickSample(padraoCatalog, tableCatalog);
    if (!sample) {
        console.error('Nenhum produto com diferença PADRAO vs TABELA 1% encontrado.');
        process.exit(1);
    }

    const tableLookup = buildCatalogPriceLookup(tableCatalog);
    const line = {
        key: sample.key,
        id: sample.id,
        hubId: sample.hubId,
        price: sample.padraoPrice,
        name: sample.name,
    };

    console.log('=== Teste live: troca de tabela + re-adicionar ===');
    console.log(`Produto: ${sample.name}`);
    console.log(`PADRAO: R$ ${sample.padraoPrice} · TABELA 1%: R$ ${sample.tablePrice}`);
    console.log('');

    const cart = {};
    simulateAddProduct(cart, line, {});
    simulateApplyOrderPriceTable(cart, tableLookup, { unlockPrices: true });
    const afterSwitch = cart[line.key].price;

    simulateRemoveProduct(cart, line.key);
    const readd = simulateAddProduct(cart, line, {
        orderTabelaPrecoId: tabela1.id,
        tablePriceLookupId: tabela1.id,
        tablePriceLookup: tableLookup,
    });

    let failed = 0;

    if (Math.abs(afterSwitch - sample.tablePrice) > 0.02) {
        console.log(`FALHA troca de tabela: esperado R$ ${sample.tablePrice}, got R$ ${afterSwitch}`);
        failed += 1;
    } else {
        console.log(`OK troca de tabela: R$ ${afterSwitch}`);
    }

    if (Math.abs(readd.price - sample.tablePrice) > 0.02) {
        console.log(
            `FALHA re-adicionar: esperado R$ ${sample.tablePrice}, got R$ ${readd.price} (PADRAO seria R$ ${sample.padraoPrice})`,
        );
        failed += 1;
    } else {
        console.log(`OK re-adicionar após remover: R$ ${readd.price}`);
    }

    // Edição: snapshot
    const snapshot = new Map([[sample.id, sample.tablePrice]]);
    simulateRemoveProduct(cart, line.key);
    const readdEdit = simulateAddProduct(
        cart,
        { ...line, price: sample.padraoPrice },
        { editing: true, editPriceSnapshot: snapshot },
    );
    if (Math.abs(readdEdit.price - sample.tablePrice) > 0.02 || !readdEdit.priceLocked) {
        console.log(`FALHA re-adicionar em edição: price=${readdEdit.price} locked=${readdEdit.priceLocked}`);
        failed += 1;
    } else {
        console.log(`OK re-adicionar em edição: R$ ${readdEdit.price} (priceLocked)`);
    }

    console.log('');
    if (failed) {
        console.log(`Resultado: ${failed} falha(s)`);
        process.exit(1);
    }
    console.log('Resultado: todos os cenários OK');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
