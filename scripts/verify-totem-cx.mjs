/**
 * Verifica se todas as CX do catálogo entram no Totem (parsePack UN/CX/PL).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.APP_BASE_URL || 'https://ligeirinhoparceiros.vercel.app';

const PACK_C_SLASH_RE = /\s+C\/(\d+)\s*$/i;
const PACK_CX_RE = /\s+CX(?:\s+(\d+))?\s*$/i;
const PACK_PL_RE = /\s+PL(?:\s+(\d+))?\s*$/i;
const PACK_UN_RE = /\s+UN(?:\s+(\d+))?\s*$/i;
const CAIXA_PREFIX_RE = /^CAIXA\s+/i;

function parsePack(name) {
    const raw = String(name || '').trim();
    let match = raw.match(PACK_PL_RE);
    if (match) return { type: 'pallet', packSize: parseInt(match[1], 10) || 1 };
    match = raw.match(PACK_UN_RE);
    if (match) return { type: 'unidade', packSize: parseInt(match[1], 10) || 1 };
    match = raw.match(PACK_CX_RE);
    if (match) return { type: 'caixa', packSize: parseInt(match[1], 10) || 1 };
    match = raw.match(PACK_C_SLASH_RE);
    if (match) return { type: 'caixa', packSize: parseInt(match[1], 10) || 1 };
    if (CAIXA_PREFIX_RE.test(raw)) return { type: 'caixa', packSize: 1 };
    return { type: 'unidade', packSize: 1 };
}

function analyze(catalog, label) {
    const products = (catalog.categories || []).flatMap((c) =>
        (c.products || []).map((p) => ({ ...p, categoryId: c.id })),
    );
    const counts = { unidade: 0, caixa: 0, pallet: 0 };
    const caixa = [];
    const missingCxMarker = [];

    for (const p of products) {
        const pack = parsePack(p.name);
        counts[pack.type] = (counts[pack.type] || 0) + 1;
        if (pack.type === 'caixa') caixa.push(p);
        // Nome parece CX mas não classificado como caixa
        if (/\bCX\b/i.test(p.name) && pack.type !== 'caixa') missingCxMarker.push(p.name);
    }

    // Totem: um card por CX (mesmo critério do product-pricing)
    const totemCards = caixa.length;
    const byId = new Set(caixa.map((p) => p.id));

    console.log(`\n=== ${label} ===`);
    console.log('Total produtos:', products.length, '| categorias:', (catalog.categories || []).length);
    console.log('UN (unidade):', counts.unidade);
    console.log('CX (caixa):', counts.caixa);
    console.log('PL (pallet):', counts.pallet);
    console.log('Cards no Totem (todas as CX):', totemCards);
    console.log('IDs CX únicos:', byId.size);
    console.log('CX com marcador no nome mas fora da lista:', missingCxMarker.length);
    if (missingCxMarker.length) {
        console.log('  ', missingCxMarker.slice(0, 10).join(' | '));
    }
    console.log(
        'Exemplos CX:',
        caixa
            .slice(0, 8)
            .map((p) => p.name)
            .join(' | '),
    );

    return {
        total: products.length,
        counts,
        totemCards,
        missingCxMarker,
        ok: missingCxMarker.length === 0 && totemCards === counts.caixa && byId.size === counts.caixa,
    };
}

const live = await fetch(`${BASE}/api/catalog`).then((r) => r.json());
const fallback = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'data', 'catalogo.json'), 'utf8'),
);

const liveResult = analyze(live, `API live (${BASE})`);
const fbResult = analyze(fallback, 'Fallback data/catalogo.json');

const liveIds = new Set(
    live.categories.flatMap((c) => c.products.map((p) => String(p.hubId || p.id))),
);
const fbIds = new Set(
    fallback.categories.flatMap((c) => c.products.map((p) => String(p.hubId || p.id))),
);
const onlyLive = [...liveIds].filter((id) => !fbIds.has(id));
const onlyFb = [...fbIds].filter((id) => !liveIds.has(id));

console.log('\n=== Fallback vs Live ===');
console.log('Só na live:', onlyLive.length);
console.log('Só no fallback:', onlyFb.length);
console.log('exportedAt fallback:', fallback.exportedAt);
console.log('exportedAt live:', live.exportedAt);

const ok = liveResult.ok && fbResult.ok && onlyLive.length === 0 && onlyFb.length === 0;
console.log(ok ? '\nOK: todas as CX entram no Totem; fallback alinhado.' : '\nATENÇÃO: revisar divergências.');
process.exit(ok ? 0 : 2);
