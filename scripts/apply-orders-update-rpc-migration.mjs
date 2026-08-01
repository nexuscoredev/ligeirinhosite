/**
 * Estende rpc_patch_order para edição de pedidos Parceiros (itens, entrega, total).
 *
 *   set SUPABASE_DB_PASSWORD=sua_senha
 *   node scripts/apply-orders-update-rpc-migration.mjs
 */
import { buildDbUrl, connectPg, PARCEIROS_REF, runSqlFile } from './apply-migration-utils.mjs';

async function main() {
    const dbUrl = buildDbUrl(PARCEIROS_REF);
    if (!dbUrl) {
        console.error('Defina SUPABASE_DB_PASSWORD ou SUPABASE_DB_URL.');
        console.error(`SQL manual: https://supabase.com/dashboard/project/${PARCEIROS_REF}/sql/new`);
        process.exit(1);
    }

    const client = await connectPg(dbUrl);
    try {
        await runSqlFile(client, 'orders-update-rpc-migration.sql');
        const { rows } = await client.query(
            `select pg_get_functiondef(p.oid) as def
             from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rpc_patch_order'
             limit 1`,
        );
        const def = String(rows[0]?.def || '');
        const ok = def.includes("p_patch->'items'") && def.includes('delivery_date');
        console.log(
            ok
                ? 'Migração rpc_patch_order (edição de pedidos) aplicada.'
                : 'Aviso: rpc_patch_order pode não incluir campos de edição.',
        );
    } finally {
        await client.end();
    }
}

main().catch((err) => {
    console.error('Falha na migração orders update:', err.message);
    process.exit(1);
});
