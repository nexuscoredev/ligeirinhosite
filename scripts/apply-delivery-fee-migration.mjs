/**
 * Adiciona coluna delivery_fee em orders (Parceiros).
 *
 *   set SUPABASE_DB_PASSWORD=sua_senha
 *   npm run migrate:delivery-fee
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
        await runSqlFile(client, 'delivery-fee-migration.sql');
        const { rows } = await client.query(
            `select column_name from information_schema.columns
             where table_schema = 'public' and table_name = 'orders' and column_name = 'delivery_fee'`,
        );
        console.log(
            rows.length
                ? 'Migração delivery_fee aplicada.'
                : 'Aviso: coluna delivery_fee não encontrada após migração.',
        );
    } finally {
        await client.end();
    }
}

main().catch((err) => {
    console.error('Falha na migração delivery_fee:', err.message);
    process.exit(1);
});
