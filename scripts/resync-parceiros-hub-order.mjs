/**
 * Ressincroniza pedido_itens no Hub a partir do pedido Parceiros.
 * Uso (com env de produção): node scripts/resync-parceiros-hub-order.mjs <parceiros-order-uuid>
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resyncHubPedidoItensFromParceiros } from './hub-parceiro-pedido.mjs';
import { parceirosSupabaseConfig } from './parceiros-supabase.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile(file) {
    if (!fs.existsSync(file)) return;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m && !process.env[m[1].trim()]) {
            process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
        }
    }
}

loadEnvFile(path.resolve(__dirname, '../.env.vercel.runtime'));
loadEnvFile(path.resolve(__dirname, '../.env.local'));

const orderId = String(process.argv[2] || '').trim();
if (!orderId) {
    console.error('Uso: node scripts/resync-parceiros-hub-order.mjs <parceiros-order-uuid>');
    process.exit(1);
}

const db = parceirosSupabaseConfig(process.env);
if (!db.serviceKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY ausente.');
    process.exit(1);
}
if (!process.env.HUB_SUPABASE_SERVICE_ROLE_KEY) {
    console.error('HUB_SUPABASE_SERVICE_ROLE_KEY ausente.');
    process.exit(1);
}

const res = await fetch(`${db.url}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=*`, {
    headers: { apikey: db.serviceKey, Authorization: `Bearer ${db.serviceKey}` },
});
const data = await res.json();
if (!res.ok || !Array.isArray(data) || !data[0]) {
    console.error('Pedido não encontrado:', data?.message || data);
    process.exit(1);
}

const order = data[0];
console.log(`Parceiros ${orderId.slice(0, 8)}: ${order.items.length} itens, R$ ${order.total}`);

const sync = await resyncHubPedidoItensFromParceiros(order, process.env);
console.log(JSON.stringify(sync, null, 2));
process.exit(sync.ok ? 0 : 1);
