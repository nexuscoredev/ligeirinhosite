/**
 * Aplica scripts/totem-schema-migration.sql no Supabase Parceiros.
 *
 *   set SUPABASE_DB_PASSWORD=sua_senha
 *   npm run migrate:totem
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
        await runSqlFile(client, 'totem-schema-migration.sql');
        const { rows } = await client.query(
            `select column_name from information_schema.columns
             where table_schema = 'public' and table_name = 'orders'
               and column_name in ('channel','totem_id','totem_label','unit_id')
             order by 1`
        );
        console.log('Migração totem aplicada.');
        console.log('Colunas orders:', rows.map((r) => r.column_name).join(', ') || '(nenhuma)');
    } finally {
        await client.end();
    }
}

main().catch((err) => {
    console.error('Falha na migração totem:', err.message);
    process.exit(1);
});
