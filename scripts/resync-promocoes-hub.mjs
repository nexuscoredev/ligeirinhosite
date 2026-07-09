#!/usr/bin/env node
/**
 * Aplica rpc_listar_promocoes_vitrine com produto_id + re-sincroniza espelho public.promocoes.
 *
 *   node scripts/resync-promocoes-hub.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HUB_ROOT = path.resolve(__dirname, '../../ligeirinhohub');
const PROJECT_REF = 'liszpwocwvkytzyaxvit';

function loadEnv(file) {
    const env = {};
    if (!fs.existsSync(file)) return env;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (!m) continue;
        env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
    return env;
}

const env = loadEnv(path.join(HUB_ROOT, '.env.local'));
const token = env.SUPABASE_ACCESS_TOKEN;
const url = (env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!token) {
    console.error('SUPABASE_ACCESS_TOKEN ausente em ligeirinhohub/.env.local');
    process.exit(1);
}
if (!url || !serviceKey) {
    console.error('VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes');
    process.exit(1);
}

const migrationSql = fs.readFileSync(
    path.join(HUB_ROOT, 'supabase/migrations/20260708200000_promocoes_vitrine_produto_id.sql'),
    'utf8',
);

async function runSql(query, label) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`${label}: HTTP ${res.status} — ${body.slice(0, 800)}`);
    console.log(`✓ ${label}`);
}

const headers = {
    apikey: env.VITE_SUPABASE_ANON_KEY || serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
};

await runSql(
    'drop function if exists public.rpc_listar_promocoes_vitrine();',
    'Drop rpc_listar_promocoes_vitrine anterior',
);
await runSql(migrationSql, 'Migration rpc_listar_promocoes_vitrine (produto_id)');

const tabelas = await fetch(`${url}/rest/v1/tabelas_preco?select=id&codigo=eq.PROMOCAO`, { headers }).then((r) =>
    r.json(),
);
const tabelaId = tabelas[0]?.id;
if (!tabelaId) throw new Error('Tabela PROMOCAO não encontrada');

const itens = await fetch(
    `${url}/rest/v1/tabelas_preco_itens?select=id&tabela_preco_id=eq.${tabelaId}&ativo=eq.true`,
    { headers },
).then((r) => r.json());

console.log(`Re-sincronizando ${itens.length} itens PROMOCAO…`);
for (const item of itens) {
    const res = await fetch(`${url}/rest/v1/rpc/sync_promocao_from_tabela_item`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ p_item_id: item.id }),
    });
    if (!res.ok) {
        const text = await res.text();
        console.warn(`  ⚠ ${item.id.slice(0, 8)}: ${text.slice(0, 120)}`);
    }
}
console.log('✓ Espelho public.promocoes atualizado');

const sample = await fetch(`${url}/rest/v1/rpc/rpc_listar_promocoes_vitrine`, {
    method: 'POST',
    headers,
    body: '{}',
}).then((r) => r.json());
const hasProdutoId = sample[0] && 'produto_id' in sample[0];
console.log(`Vitrine com produto_id: ${hasProdutoId ? 'sim' : 'não'} (${sample.length} itens ativos)`);
