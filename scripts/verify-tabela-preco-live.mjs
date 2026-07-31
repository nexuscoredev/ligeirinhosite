/**
 * Verifica se os preços das tabelas do Hub batem com o catálogo ao vivo do Parceiros.
 * Uso: node scripts/verify-tabela-preco-live.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { hubConfig } from './hub-auth.mjs';
import {
    buildCatalog,
    fetchCatalogFromHub,
    fetchHubCatalogData,
    listActivePriceTables,
    resolveCatalogPrice,
} from './lib/hub-catalog.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIVE_BASE = process.env.APP_BASE_URL || 'https://ligeirinhoparceiros.vercel.app';

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

function flattenCatalog(catalog) {
    const items = [];
    for (const cat of catalog?.categories || []) {
        for (const p of cat.products || []) {
            items.push({ ...p, categoryId: cat.id });
        }
    }
    return items;
}

function buildCartLookup(catalog) {
    const map = new Map();
    for (const p of flattenCatalog(catalog)) {
        const cartKey = `${p.categoryId}::${p.id}`;
        map.set(cartKey, p.price);
    }
    return map;
}

function priceEqual(a, b) {
    return Math.abs(Number(a) - Number(b)) <= 0.001;
}

async function fetchLiveCatalog(query = 'sync=1') {
    const url = `${LIVE_BASE}/api/catalog?${query}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const text = await res.text();
    let json = null;
    try {
        json = JSON.parse(text);
    } catch {
        json = { error: text.slice(0, 200) };
    }
    return { status: res.status, json };
}

async function verifyTable(config, tabela, produtos, categorias) {
    const { tabelaPadrao, priceMap } = await fetchHubCatalogData(config, {
        channel: 'parceiros',
        tabelaPrecoId: tabela.id,
    });

    const catalog = buildCatalog(produtos, categorias, {
        channel: 'parceiros',
        tabelaPadrao,
        priceMap,
    });

    const prodByHubId = new Map(produtos.map((p) => [String(p.id), p]));
    const mismatches = [];
    const cartMiss = [];

    for (const item of flattenCatalog(catalog)) {
        const hubProd = prodByHubId.get(String(item.hubId));
        if (!hubProd) continue;

        const expected = resolveCatalogPrice(hubProd, priceMap, tabelaPadrao);
        if (!priceEqual(item.price, expected)) {
            mismatches.push({
                name: item.name,
                hubId: item.hubId,
                catalog: item.price,
                expected,
                unidade: item.unidade,
            });
        }

        const cartKey = `${item.categoryId}::${item.id}`;
        const cartLookup = buildCartLookup(catalog);
        const cartPrice = cartLookup.get(cartKey);
        if (cartPrice != null && !priceEqual(cartPrice, item.price)) {
            cartMiss.push({ cartKey, cartPrice, itemPrice: item.price, name: item.name });
        }
    }

    return {
        codigo: tabela.codigo,
        id: tabela.id,
        padrao: tabela.padrao,
        aplicacao: tabelaPadrao?.aplicacao,
        totalProducts: catalog.totalProducts,
        mismatches,
        cartMiss,
        priceTableId: tabelaPadrao?.id,
    };
}

async function compareLiveVsLocal(localCatalog, label) {
    const live = await fetchLiveCatalog(`sync=${Date.now()}`);
    if (live.status !== 200) {
        return { ok: false, error: `HTTP ${live.status}: ${live.json?.error || 'erro'}` };
    }

    const localByHub = new Map(
        flattenCatalog(localCatalog)
            .filter((p) => p.hubId)
            .map((p) => [String(p.hubId), p]),
    );
    const liveByHub = new Map(
        flattenCatalog(live.json)
            .filter((p) => p.hubId)
            .map((p) => [String(p.hubId), p]),
    );

    const diffs = [];
    for (const [hubId, lp] of localByHub) {
        const rp = liveByHub.get(hubId);
        if (!rp) continue;
        if (!priceEqual(lp.price, rp.price)) {
            diffs.push({
                name: lp.name,
                hubId,
                local: lp.price,
                live: rp.price,
            });
        }
    }

    return {
        ok: diffs.length === 0,
        label,
        liveTotal: live.json.totalProducts,
        localTotal: localCatalog.totalProducts,
        liveTable: live.json.priceTableCodigo || live.json.priceTableId,
        localTable: localCatalog.priceTableCodigo || localCatalog.priceTableId,
        diffs: diffs.slice(0, 15),
        diffCount: diffs.length,
    };
}

async function sampleTabelaItens(config, tabelaId, limit = 20) {
    const hub = {
        url: config.url,
        anonKey: config.anonKey,
        token: config.serviceKey,
    };
    const url =
        `${hub.url}/rest/v1/tabelas_preco_itens?select=produto_id,preco,ativo` +
        `&tabela_preco_id=eq.${encodeURIComponent(tabelaId)}&ativo=eq.true&limit=${limit}`;
    const res = await fetch(url, {
        headers: {
            apikey: hub.anonKey,
            Authorization: `Bearer ${hub.token}`,
        },
    });
    if (!res.ok) return [];
    return res.json();
}

async function main() {
    const config = hubConfig(env);
    if (!config.serviceKey) {
        console.error('HUB_SUPABASE_SERVICE_ROLE_KEY ausente (ligeirinhohub/.env.local).');
        process.exit(1);
    }

    console.log('=== Verificação tabela de preço — Parceiros vs Hub ===');
    console.log('Produção:', LIVE_BASE);
    console.log('Hub:', config.url);
    console.log('');

    const hub = { url: config.url, anonKey: config.anonKey, token: config.serviceKey };
    const tabelas = await listActivePriceTables(hub);
    console.log(`Tabelas ativas no Hub: ${tabelas.length}`);
    tabelas.forEach((t) => {
        console.log(`  - ${t.codigo}${t.padrao ? ' (PADRAO)' : ''} · ${t.nome || ''} · id=${t.id}`);
    });
    console.log('');

    const { categorias, produtos } = await fetchHubCatalogData(config, { channel: 'parceiros' });

    const padraoCatalog = await fetchCatalogFromHub(env, { channel: 'parceiros', syncMode: 'live' });
    const liveCompare = await compareLiveVsLocal(padraoCatalog, 'tabela PADRAO');
    console.log('--- Tabela PADRAO vs /api/catalog (produção) ---');
    if (liveCompare.error) {
        console.log('ERRO:', liveCompare.error);
    } else if (liveCompare.ok) {
        console.log(
            `OK — ${liveCompare.localTotal} produtos, preços idênticos (tabela ${liveCompare.liveTable})`,
        );
    } else {
        console.log(
            `DIVERGÊNCIA — ${liveCompare.diffCount} preço(s) diferente(s) entre local e produção`,
        );
        liveCompare.diffs.forEach((d) => {
            console.log(`  ${d.name}: local R$ ${d.local} · live R$ ${d.live}`);
        });
    }
    console.log('');

    let totalInternalMismatch = 0;
    let totalCartMiss = 0;

    for (const tabela of tabelas) {
        const result = await verifyTable(config, tabela, produtos, categorias);
        const tag = result.padrao ? 'PADRAO' : result.codigo;
        console.log(`--- Tabela ${tag} (${result.totalProducts} produtos) ---`);

        if (result.mismatches.length === 0 && result.cartMiss.length === 0) {
            console.log('OK — resolveCatalogPrice e lookup do carrinho consistentes');
        } else {
            if (result.mismatches.length) {
                console.log(`  ${result.mismatches.length} produto(s) com preço != resolveCatalogPrice:`);
                result.mismatches.slice(0, 8).forEach((m) => {
                    console.log(
                        `    ${m.name} (${m.unidade}): catálogo R$ ${m.catalog} · esperado R$ ${m.expected}`,
                    );
                });
                totalInternalMismatch += result.mismatches.length;
            }
            if (result.cartMiss.length) {
                console.log(`  ${result.cartMiss.length} falha(s) no lookup cartKey:`);
                result.cartMiss.slice(0, 5).forEach((m) => console.log(`    ${m.cartKey} · ${m.name}`));
                totalCartMiss += result.cartMiss.length;
            }
        }

        if (!result.padrao && result.aplicacao !== 'todos_produtos') {
            const samples = await sampleTabelaItens(config, tabela.id, 12);
            if (samples.length) {
                const catalogItems = flattenCatalog(
                    buildCatalog(produtos, categorias, {
                        tabelaPadrao: (
                            await fetchHubCatalogData(config, {
                                channel: 'parceiros',
                                tabelaPrecoId: tabela.id,
                            })
                        ).tabelaPadrao,
                        priceMap: (
                            await fetchHubCatalogData(config, {
                                channel: 'parceiros',
                                tabelaPrecoId: tabela.id,
                            })
                        ).priceMap,
                    }),
                );
                const byHub = new Map(catalogItems.map((p) => [String(p.hubId), p]));
                let itemOk = 0;
                let itemFail = 0;
                const itemSamples = [];
                for (const row of samples) {
                    const cat = byHub.get(String(row.produto_id));
                    if (!cat) continue;
                    const unitTable = Number(row.preco);
                    if (priceEqual(cat.price, unitTable)) {
                        itemOk += 1;
                    } else {
                        itemFail += 1;
                        if (itemSamples.length < 5) {
                            itemSamples.push({
                                name: cat.name,
                                unidade: cat.unidade,
                                tabelaItem: unitTable,
                                catalog: cat.price,
                            });
                        }
                    }
                }
                console.log(
                    `  Amostra itens tabela (${samples.length}): ${itemOk} OK · ${itemFail} divergente(s)`,
                );
                itemSamples.forEach((s) => {
                    console.log(
                        `    ${s.name} (${s.unidade}): item R$ ${s.tabelaItem} · catálogo R$ ${s.catalog}`,
                    );
                });
            }
        }
        console.log('');
    }

    console.log('=== Resumo ===');
    const liveOk = liveCompare.ok === true;
    const logicOk = totalInternalMismatch === 0 && totalCartMiss === 0;
    if (liveOk && logicOk) {
        console.log('✓ Preços das tabelas estão alinhados Hub ↔ Parceiros (produção).');
        process.exit(0);
    }
    if (!liveOk) console.log('✗ Produção diverge do cálculo local (cache ou deploy?).');
    if (!logicOk) console.log('✗ Inconsistência interna na resolução de preços.');
    process.exit(1);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
