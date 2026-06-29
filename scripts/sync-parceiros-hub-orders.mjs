/**
 * Reenvia ao Hub pedidos Parceiros sem hub_pedido_id.
 * Requer SUPABASE_SERVICE_ROLE_KEY e HUB_SUPABASE_SERVICE_ROLE_KEY no ambiente.
 *
 *   node scripts/sync-parceiros-hub-orders.mjs
 *   node scripts/sync-parceiros-hub-orders.mjs --limit=20
 */
import { paymentEnv } from './payment-env.mjs';
import { ensureHubPedidoForParceiros } from './hub-parceiro-pedido.mjs';
import { patchOrder, dbFromPaymentConfig } from './supabase-orders.mjs';

const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = Math.min(100, Math.max(1, Number(limitArg?.split('=')[1]) || 50));

async function fetchPendingOrders(db) {
    const params = new URLSearchParams({
        channel: 'eq.parceiros',
        hub_pedido_id: 'is.null',
        select: '*',
        order: 'created_at.desc',
        limit: String(limit),
    });
    const res = await fetch(`${db.url}/rest/v1/orders?${params}`, {
        headers: {
            apikey: db.apiKey,
            Authorization: `Bearer ${db.apiKey}`,
        },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || 'Falha ao listar pedidos');
    return Array.isArray(data) ? data : [];
}

async function main() {
    const config = paymentEnv(process.env);
    const db = dbFromPaymentConfig(config);
    if (!db.url || !db.key) {
        console.error('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou anon + RPC).');
        process.exit(1);
    }
    if (!process.env.HUB_SUPABASE_SERVICE_ROLE_KEY) {
        console.error('Defina HUB_SUPABASE_SERVICE_ROLE_KEY.');
        process.exit(1);
    }

    const orders = await fetchPendingOrders({ url: db.url, apiKey: db.key });
    if (!orders.length) {
        console.log('Nenhum pedido parceiros pendente de sync.');
        return;
    }

    console.log(`Sincronizando até ${orders.length} pedido(s)…`);
    let ok = 0;
    let fail = 0;

    for (const order of orders) {
        try {
            const hubPedido = await ensureHubPedidoForParceiros(order, process.env);
            if (!hubPedido?.id) {
                fail += 1;
                console.warn(
                    `  ✗ ${order.id.slice(0, 8)} — cliente parceiro não encontrado (${order.customer_email || 'sem e-mail'})`,
                );
                continue;
            }
            await patchOrder(db.url, db.key, order.id, { hub_pedido_id: hubPedido.id }, { useRpc: db.useRpc });
            ok += 1;
            console.log(`  ✓ ${order.id.slice(0, 8)} → Hub #${hubPedido.numero ?? hubPedido.id}`);
        } catch (err) {
            fail += 1;
            console.warn(`  ✗ ${order.id.slice(0, 8)} — ${err.message || err}`);
        }
    }

    console.log(`\nConcluído: ${ok} sincronizado(s), ${fail} falha(s).`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
