/**
 * Aplica todas as migrações pendentes conhecidas do repositório.
 *
 * Parceiros (ligeirinhoparceiros): finance + totem
 * Hub (ligeirinhohub): auth parceiros (CNPJ, must_change_password)
 *
 *   set SUPABASE_DB_PASSWORD=...          # Parceiros
 *   set HUB_SUPABASE_DB_PASSWORD=...      # Hub (opcional nesta execução)
 *   npm run migrate:all
 */
import { buildDbUrl, connectPg, HUB_REF, PARCEIROS_REF, runSqlFile } from './apply-migration-utils.mjs';

async function applyParceiros() {
    const dbUrl = buildDbUrl(PARCEIROS_REF);
    if (!dbUrl) {
        console.warn('[parceiros] Sem SUPABASE_DB_PASSWORD — pulando (aplique SQL manualmente).');
        return false;
    }

    const client = await connectPg(dbUrl);
    try {
        console.log('[parceiros] Aplicando finance-schema-migration.sql…');
        await runSqlFile(client, 'finance-schema-migration.sql');
        console.log('[parceiros] Aplicando totem-schema-migration.sql…');
        await runSqlFile(client, 'totem-schema-migration.sql');

        const tables = await client.query(
            `select table_name from information_schema.tables
             where table_schema = 'public'
               and table_name in ('customers','mp_charges','payment_events')
             order by 1`
        );
        const cols = await client.query(
            `select column_name from information_schema.columns
             where table_schema = 'public' and table_name = 'orders'
               and column_name in ('channel','financial_status','totem_id')
             order by 1`
        );
        console.log('[parceiros] Tabelas finance:', tables.rows.map((r) => r.table_name).join(', '));
        console.log('[parceiros] Colunas orders:', cols.rows.map((r) => r.column_name).join(', '));
        return true;
    } finally {
        await client.end();
    }
}

async function applyHub() {
    const dbUrl = buildDbUrl(HUB_REF, {
        ...process.env,
        SUPABASE_DB_PASSWORD: process.env.HUB_SUPABASE_DB_PASSWORD,
        SUPABASE_DB_URL: process.env.HUB_SUPABASE_DB_URL,
    });
    if (!dbUrl) {
        console.warn('[hub] Sem HUB_SUPABASE_DB_PASSWORD — pulando (aplique hub-parceiros-auth-migration.sql manualmente).');
        return false;
    }

    const client = await connectPg(dbUrl);
    try {
        console.log('[hub] Aplicando hub-parceiros-auth-migration.sql…');
        await runSqlFile(client, 'hub-parceiros-auth-migration.sql');
        return true;
    } finally {
        await client.end();
    }
}

async function main() {
    const parceiros = await applyParceiros();
    const hub = await applyHub();

    if (!parceiros && !hub) {
        console.error('\nNenhuma migração aplicada. Configure as senhas do banco ou use o SQL Editor.');
        process.exit(1);
    }

    console.log('\nConcluído.');
    if (!hub) {
        console.log('Pendente manual Hub:', `https://supabase.com/dashboard/project/${HUB_REF}/sql/new`);
    }
}

main().catch((err) => {
    console.error('Falha:', err.message);
    process.exit(1);
});
