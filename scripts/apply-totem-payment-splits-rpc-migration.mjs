/**
 * Atualiza rpc_patch_order para gravar notes (splits de pagamento no totem).
 *
 *   set SUPABASE_DB_PASSWORD=sua_senha
 *   npm run migrate:totem-payment-splits
 *
 * SQL manual: https://supabase.com/dashboard/project/tugbsnjyvfhyvtivfhea/sql/new
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
        await runSqlFile(client, 'totem-payment-splits-rpc-migration.sql');
        const { rows } = await client.query(
            `select pg_get_functiondef(p.oid) as def
             from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rpc_patch_order'
             limit 1`,
        );
        const hasNotes = String(rows[0]?.def || '').includes('notes = coalesce');
        console.log(hasNotes ? 'Migração rpc_patch_order (notes) aplicada.' : 'Aviso: rpc_patch_order sem campo notes.');
    } finally {
        await client.end();
    }
}

main().catch((err) => {
    console.error('Falha na migração totem payment splits:', err.message);
    process.exit(1);
});
