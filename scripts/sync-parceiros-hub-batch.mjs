/**
 * Sincroniza pedidos Parceiros com o Hub.
 * Busca pedidos via rpc_get_order (anon) e atualiza hub_pedido_id via rpc_patch_order.
 *
 *   node scripts/sync-parceiros-hub-batch.mjs --ids=uuid1,uuid2
 *   node scripts/sync-parceiros-hub-batch.mjs scripts/.order-ids.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureHubPedidoForParceiros } from './hub-parceiro-pedido.mjs';
import { PARCEIROS_SUPABASE_ANON_KEY, PARCEIROS_SUPABASE_URL } from './parceiros-supabase.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadHubEnv() {
    const hubEnvPath = path.resolve(root, '..', 'ligeirinhohub', '.env.local');
    if (!fs.existsSync(hubEnvPath)) {
        throw new Error('ligeirinhohub/.env.local não encontrado.');
    }
    for (const line of fs.readFileSync(hubEnvPath, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (!m) continue;
        const key = m[1].trim();
        let val = m[2].trim();
        if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
        ) {
            val = val.slice(1, -1);
        }
        if (key === 'SUPABASE_SERVICE_ROLE_KEY') {
            process.env.HUB_SUPABASE_SERVICE_ROLE_KEY = val;
        }
    }
    if (!process.env.HUB_SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('HUB_SUPABASE_SERVICE_ROLE_KEY ausente em ligeirinhohub/.env.local');
    }
}

function parceirosHeaders() {
    const key = process.env.SUPABASE_ANON_KEY || PARCEIROS_SUPABASE_ANON_KEY;
    return {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
    };
}

async function fetchOrderById(id) {
    const url = (process.env.SUPABASE_URL || PARCEIROS_SUPABASE_URL).replace(/\/$/, '');
    const res = await fetch(`${url}/rest/v1/rpc/rpc_get_order`, {
        method: 'POST',
        headers: parceirosHeaders(),
        body: JSON.stringify({ p_id: id }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message || `rpc_get_order ${res.status}`);
    return data && typeof data === 'object' ? data : null;
}

async function patchHubPedidoId(orderId, hubPedidoId) {
    const url = (process.env.SUPABASE_URL || PARCEIROS_SUPABASE_URL).replace(/\/$/, '');
    const res = await fetch(`${url}/rest/v1/rpc/rpc_patch_order`, {
        method: 'POST',
        headers: parceirosHeaders(),
        body: JSON.stringify({ p_id: orderId, p_patch: { hub_pedido_id: hubPedidoId } }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message || `rpc_patch_order ${res.status}`);
    return data;
}

function normalizeOrder(row) {
    return {
        ...row,
        channel: row.channel || 'parceiros',
        total: Number(row.total) || 0,
        items: Array.isArray(row.items) ? row.items : [],
    };
}

function parseIds(argv) {
    const idsArg = argv.find((a) => a.startsWith('--ids='));
    if (idsArg) {
        return idsArg
            .slice(6)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    }
    const file = argv[2];
    if (!file) return [];
    const raw = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
    if (Array.isArray(raw)) return raw.map(String);
    if (Array.isArray(raw.ids)) return raw.ids.map(String);
    return [];
}

async function main() {
    const ids = parseIds(process.argv.slice(2));
    if (!ids.length) {
        console.error('Uso: node scripts/sync-parceiros-hub-batch.mjs --ids=uuid1,uuid2');
        console.error('  ou: node scripts/sync-parceiros-hub-batch.mjs scripts/.order-ids.json');
        process.exit(1);
    }

    loadHubEnv();
    console.log(`Sincronizando ${ids.length} pedido(s) com o Hub…`);

    let ok = 0;
    let fail = 0;

    for (const id of ids) {
        const short = id.slice(0, 8);
        try {
            const row = await fetchOrderById(id);
            if (!row?.id) {
                fail += 1;
                console.warn(`  ✗ ${short} — pedido não encontrado`);
                continue;
            }
            const order = normalizeOrder(row);
            const hubPedido = await ensureHubPedidoForParceiros(order, process.env);
            if (!hubPedido?.id) {
                fail += 1;
                console.warn(
                    `  ✗ ${short} — cliente parceiro não encontrado (${order.customer_email || 'sem e-mail'})`,
                );
                continue;
            }
            if (order.hub_pedido_id !== hubPedido.id) {
                await patchHubPedidoId(order.id, hubPedido.id);
            }
            ok += 1;
            console.log(`  ✓ ${short} → Hub #${hubPedido.numero ?? hubPedido.id}`);
        } catch (err) {
            fail += 1;
            console.warn(`  ✗ ${short} — ${err.message || err}`);
        }
    }

    console.log(`\nConcluído: ${ok} sincronizado(s), ${fail} falha(s).`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
