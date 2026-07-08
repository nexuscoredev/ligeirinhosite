/**
 * Verifica se todas as CX do catálogo entram no Totem.
 * Prioridade: campo `unidade` do Hub; fallback: sufixo no nome (C/12, CX, etc.).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.APP_BASE_URL || 'https://ligeirinhoparceiros.vercel.app';
const ROOT = path.join(__dirname, '..');

function loadParsePackFromProductPricing() {
    const code = fs.readFileSync(path.join(ROOT, 'js', 'product-pricing.js'), 'utf8');
    const sandbox = { window: {}, console };
    vm.runInNewContext(code, sandbox, { filename: 'product-pricing.js' });
    const parsePack = sandbox.window.LigeirinhoPricing?.parsePack;
    if (typeof parsePack !== 'function') {
        throw new Error('LigeirinhoPricing.parsePack não encontrado em js/product-pricing.js');
    }
    return parsePack;
}

const parsePack = loadParsePackFromProductPricing();

function analyze(catalog, label) {
    const products = (catalog.categories || []).flatMap((c) =>
        (c.products || []).map((p) => ({ ...p, categoryId: c.id })),
    );
    const counts = { unidade: 0, caixa: 0, pallet: 0 };
    const caixa = [];
    const hubCxMissedByName = [];

    for (const p of products) {
        const pack = parsePack(p);
        counts[pack.type] = (counts[pack.type] || 0) + 1;
        if (pack.type === 'caixa') caixa.push(p);

        const unidade = String(p.unidade || '').toUpperCase();
        if ((unidade === 'CX' || unidade === 'FD') && pack.type !== 'caixa') {
            hubCxMissedByName.push(p.name);
        }
    }

    const totemCards = caixa.length;
    const byId = new Set(caixa.map((p) => p.id));
    const withUnidade = products.filter((p) => p.unidade).length;

    console.log(`\n=== ${label} ===`);
    console.log('Total produtos:', products.length, '| categorias:', (catalog.categories || []).length);
    console.log('Com campo unidade:', withUnidade);
    console.log('UN (unidade):', counts.unidade);
    console.log('CX (caixa):', counts.caixa);
    console.log('PL (pallet):', counts.pallet);
    console.log('Cards no Totem (todas as CX):', totemCards);
    console.log('IDs CX únicos:', byId.size);
    console.log('Hub CX não classificada como caixa:', hubCxMissedByName.length);
    if (hubCxMissedByName.length) {
        console.log('  ', hubCxMissedByName.slice(0, 10).join(' | '));
    }
    console.log(
        'Exemplos CX:',
        caixa
            .slice(0, 8)
            .map((p) => `${p.name}${p.unidade ? ` [${p.unidade}]` : ''}`)
            .join(' | '),
    );

    return {
        total: products.length,
        counts,
        totemCards,
        hubCxMissedByName,
        withUnidade,
        ok: hubCxMissedByName.length === 0 && totemCards === counts.caixa && byId.size === counts.caixa,
    };
}

const live = await fetch(`${BASE}/api/catalog`).then((r) => r.json());
const fallback = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'data', 'catalogo.json'), 'utf8'),
);

const liveResult = analyze(live, `API live (${BASE})`);
const fbResult = analyze(fallback, 'Fallback data/catalogo.json');

console.log('\n=== Local parse (product-pricing.js) vs expectativa ===');
console.log(
    'Se live/fallback ainda não tiverem `unidade`, rode o export do catálogo e o deploy do site.',
);

const ok = liveResult.ok && fbResult.ok;
console.log(ok ? '\nOK: classificação CX consistente.' : '\nATENÇÃO: revisar divergências / republicar catálogo.');
process.exit(ok ? 0 : 2);
