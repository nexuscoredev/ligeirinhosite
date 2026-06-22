const BEER_SLUGS = new Set(['cerveja', 'cervejas']);

export function isBeerCategory(categoryId) {
    const id = String(categoryId || '').toLowerCase();
    return BEER_SLUGS.has(id) || id.includes('cerveja');
}

/** Mapa productId e nome normalizado → categoria. */
export function buildProductCategoryIndex(catalog) {
    const byId = new Map();
    const byName = new Map();
    for (const cat of catalog?.categories || []) {
        const sort = cat.sortOrder ?? 999;
        for (const p of cat.products || []) {
            const meta = {
                categoryId: cat.id,
                categoryName: cat.name,
                sortOrder: sort,
                beerPriority: isBeerCategory(cat.id) ? 0 : 1,
            };
            byId.set(String(p.id), meta);
            const key = normalizeName(p.name);
            if (key && !byName.has(key)) byName.set(key, meta);
        }
    }
    return { byId, byName };
}

function normalizeName(name) {
    return String(name || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}

export function resolveItemCategory(item, index) {
    const id = String(item.id || item.cartKey || '').trim();
    const nameKey = normalizeName(item.name);
    return (
        index.byId.get(id) ||
        index.byName.get(nameKey) || {
            categoryId: 'outros',
            categoryName: 'OUTROS',
            sortOrder: 999,
            beerPriority: 1,
        }
    );
}

export function buildPickLines(orderItems, categoryIndex) {
    const lines = (orderItems || []).map((item, i) => {
        const cat = resolveItemCategory(item, categoryIndex);
        const qty = Math.max(1, Number(item.qty) || 1);
        return {
            line_index: i,
            product_id: String(item.id || item.cartKey || '').slice(0, 120) || null,
            product_name: String(item.name || 'Item').slice(0, 200),
            qty,
            picked_qty: 0,
            category_id: cat.categoryId,
            category_name: cat.categoryName,
            sort_order: cat.sortOrder,
            beer_priority: cat.beerPriority,
            status: 'pendente',
        };
    });

    return lines.sort(
        (a, b) =>
            a.beer_priority - b.beer_priority ||
            a.sort_order - b.sort_order ||
            a.product_name.localeCompare(b.product_name, 'pt-BR')
    );
}

export function pickProgress(lines) {
    const total = lines.length;
    const done = lines.filter((l) => l.status === 'feito' || l.picked_qty >= l.qty).length;
    return { done, total, label: total ? `${done}/${total}` : '0/0' };
}

export function nextPickStatus(qty, pickedQty) {
    if (pickedQty <= 0) return 'pendente';
    if (pickedQty >= qty) return 'feito';
    return 'parcial';
}
