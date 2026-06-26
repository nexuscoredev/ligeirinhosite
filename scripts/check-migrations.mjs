/**
 * Verifica estado das migrações (somente leitura).
 * Usa SUPABASE_DB_PASSWORD (Parceiros) e HUB_SUPABASE_DB_PASSWORD (Hub).
 */
import { buildDbUrl, connectPg, HUB_REF, PARCEIROS_REF } from './apply-migration-utils.mjs';

async function checkParceiros() {
    const dbUrl = buildDbUrl(PARCEIROS_REF);
    if (!dbUrl) return { ok: false, reason: 'sem credencial Parceiros' };

    const client = await connectPg(dbUrl);
    try {
        const tables = await client.query(
            `select table_name from information_schema.tables
             where table_schema = 'public'
               and table_name in ('customers','mp_charges','wallet','payment_events','finance_settings')
             order by 1`
        );
        const orderCols = await client.query(
            `select column_name from information_schema.columns
             where table_schema = 'public' and table_name = 'orders'
             order by ordinal_position`
        );
        const colSet = new Set(orderCols.rows.map((r) => r.column_name));
        const needFinance = ['customer_id', 'financial_status', 'payment_method'];
        const needTotem = ['channel', 'totem_id', 'totem_label', 'unit_id'];
        const needSeparation = ['separation_status', 'separation_started_at'];
        const needPix = ['pix_txid', 'pix_provider'];

        const pickTable = await client.query(
            `select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'order_pick_items'`
        );

        const pixRpc = await client.query(
            `select 1 from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rpc_fetch_order_by_pix_txid'`
        );

        return {
            ok: true,
            tables: tables.rows.map((r) => r.table_name),
            financeOk: needFinance.every((c) => colSet.has(c)),
            totemOk: needTotem.every((c) => colSet.has(c)),
            separationOk:
                needSeparation.every((c) => colSet.has(c)) && pickTable.rows.length > 0,
            pixOk: needPix.every((c) => colSet.has(c)) && pixRpc.rows.length > 0,
            missingFinance: needFinance.filter((c) => !colSet.has(c)),
            missingTotem: needTotem.filter((c) => !colSet.has(c)),
            missingSeparation: [
                ...needSeparation.filter((c) => !colSet.has(c)),
                ...(pickTable.rows.length ? [] : ['order_pick_items']),
            ],
            missingPix: [
                ...needPix.filter((c) => !colSet.has(c)),
                ...(pixRpc.rows.length ? [] : ['rpc_fetch_order_by_pix_txid']),
            ],
        };
    } finally {
        await client.end();
    }
}

async function checkHub() {
    const dbUrl = buildDbUrl(HUB_REF, {
        ...process.env,
        SUPABASE_DB_PASSWORD: process.env.HUB_SUPABASE_DB_PASSWORD,
        SUPABASE_DB_URL: process.env.HUB_SUPABASE_DB_URL,
    });
    if (!dbUrl) return { ok: false, reason: 'sem credencial Hub' };

    const client = await connectPg(dbUrl);
    try {
        const col = await client.query(
            `select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'usuarios' and column_name = 'must_change_password'`
        );
        const fn = await client.query(
            `select pg_get_functiondef(p.oid) as def
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'resolve_login_email'`
        );
        const def = fn.rows[0]?.def || '';
        const cnpjInFn = /regexp_replace|digits\.doc/i.test(def);
        return {
            ok: true,
            mustChangePassword: col.rows.length > 0,
            resolveLoginEmail: fn.rows.length > 0,
            cnpjSupport: cnpjInFn,
        };
    } finally {
        await client.end();
    }
}

async function main() {
    console.log('=== Parceiros', PARCEIROS_REF, '===');
    const p = await checkParceiros();
    if (!p.ok) console.log('Não verificado:', p.reason);
    else {
        console.log('Finance:', p.financeOk ? 'OK' : `PENDENTE (${p.missingFinance.join(', ')})`);
        console.log('Totem:', p.totemOk ? 'OK' : `PENDENTE (${p.missingTotem.join(', ')})`);
        console.log('Separação:', p.separationOk ? 'OK' : `PENDENTE (${p.missingSeparation.join(', ')})`);
        console.log('Pix Santander:', p.pixOk ? 'OK' : `PENDENTE (${p.missingPix.join(', ')})`);
        console.log('Tabelas:', p.tables.join(', ') || '(nenhuma finance)');
    }

    console.log('\n=== Hub', HUB_REF, '===');
    const h = await checkHub();
    if (!h.ok) console.log('Não verificado:', h.reason);
    else {
        console.log('must_change_password:', h.mustChangePassword ? 'OK' : 'PENDENTE');
        console.log('resolve_login_email:', h.resolveLoginEmail ? 'OK' : 'PENDENTE');
        console.log('CNPJ em resolve_login_email:', h.cnpjSupport ? 'OK' : 'verificar');
    }
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
