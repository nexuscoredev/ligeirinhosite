/**
 * Compara tabelas percentuais (custo + X%) no Parceiros vs fórmula esperada.
 * Uso: node scripts/audit-percent-tables.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { hubConfig } from './hub-auth.mjs';
import {
    fetchCatalogFromHub,
    fetchHubCatalogData,
    listActivePriceTables,
    resolveCatalogPrice,
} from './lib/hub-catalog.mjs';
import { precoBaseUnitarioDoProduto } from './lib/hub-promo-precos.mjs';

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

function flat(catalog) {
    const out = [];
    for (const cat of catalog?.categories || []) {
        for (const p of cat.products || []) out.push({ ...p, categoryId: cat.id });
    }
    return out;
}

function priceEqual(a, b, tol = 0.02) {
    return Math.abs(Number(a) - Number(b)) <= tol;
}

async function auditPercentTable(config, envLocal, tabela, produtos) {
    const prodById = new Map(produtos.map((p) => [String(p.id), p]));
    const catalog = await fetchCatalogFromHub(envLocal, {
        channel: 'parceiros',
        syncMode: 'live',
        tabelaPrecoId: tabela.id,
    });
    const ctx = await fetchHubCatalogData(config, {
        channel: 'parceiros',
        tabelaPrecoId: tabela.id,
    });

    const pct = Number(tabela.percentual) || 0;
    let ok = 0;
    let bad = 0;
    let badPl = 0;
    let badOther = 0;
    const samples = [];

    for (const item of flat(catalog)) {
        const p = prodById.get(String(item.hubId));
        if (!p) continue;

        const u = String(item.unidade || p.unidade || '');
        // PL usa enrichCatalogPalletPrices (CX × caixas) — comparar só CX/UN
        if (u === 'PL') continue;

        const custoUnit = precoBaseUnitarioDoProduto(p, Number(p.valor_custo) || 0);
        const expectedUnit = Math.round(custoUnit * (1 + pct / 100) * 100) / 100;
        const expectedCatalog = resolveCatalogPrice(p, ctx.priceMap, ctx.tabelaPadrao, {
            basePriceMap: ctx.basePriceMap,
        });

        if (priceEqual(item.price, expectedCatalog)) {
            ok += 1;
            continue;
        }

        bad += 1;
        badOther += 1;

        if (samples.length < 5) {
            samples.push({
                name: item.name,
                unidade: u,
                catalog: item.price,
                expected: expectedCatalog,
                custoUnit,
                expectedUnit,
            });
        }
    }

    return { pct, ok, bad, badPl, badOther, samples, total: ok + bad };
}

async function main() {
    const config = hubConfig(env);
    if (!config.serviceKey) {
        console.error('HUB_SUPABASE_SERVICE_ROLE_KEY ausente.');
        process.exit(1);
    }

    const hub = { url: config.url, anonKey: config.anonKey, token: config.serviceKey };
    const tabelas = await listActivePriceTables(hub);
    const { produtos } = await fetchHubCatalogData(config, { channel: 'parceiros' });

    // listActivePriceTables não traz aplicacao/modo/percentual — resolve via fetchHubCatalogData
    const percentTables = [];
    for (const t of tabelas) {
        const { tabelaPadrao } = await fetchHubCatalogData(config, {
            channel: 'parceiros',
            tabelaPrecoId: t.id,
        });
        if (
            tabelaPadrao?.aplicacao === 'todos_produtos' &&
            tabelaPadrao?.modo === 'acrescimo' &&
            Number(tabelaPadrao.percentual) > 0
        ) {
            percentTables.push({ ...t, ...tabelaPadrao });
        }
    }

    console.log('=== Tabelas percentuais (custo + X%) — Parceiros ===\n');

    for (const t of percentTables) {
        const r = await auditPercentTable(config, env, t, produtos);
        const status = r.bad === 0 ? 'OK' : 'DIVERGE';
        console.log(
            `${status} · ${t.codigo} (+${r.pct}%) — ${r.ok}/${r.total} OK · ${r.bad} divergente(s) (${r.badOther} CX/UN · ${r.badPl} PL)`,
        );
        if (r.samples.length) {
            for (const s of r.samples) {
                console.log(
                    `    ${s.name} [${s.unidade}]: catálogo R$ ${s.catalog} · esperado R$ ${s.expected} · custo unit R$ ${s.custoUnit}`,
                );
            }
        }
        console.log('');
    }

    const promo = tabelas.find((t) => t.codigo === 'PROMOCAO');
    if (promo) {
        console.log('--- PROMOCAO (lista manual, não é custo + %) ---');
        const r = await auditPercentTable(config, env, promo, produtos);
        console.log(
            `Nota: ${r.bad}/${r.total} itens não batem fórmula percentual (esperado — preços manuais)`,
        );
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
