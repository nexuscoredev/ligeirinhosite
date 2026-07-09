(function () {
    const CACHE_MS = 60_000;

    const MARCADOR_EMBALAGEM_NOME = /\s+(PCT|PCTO|CX|PC|FARDO|FD|PACK|PACOTE|PL)\b/i;
    const SUFIXO_C_BARRA = /\s+C\/\s*\d+.*$/i;

    const normalizeName = (value) =>
        String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+C\/\d+\s*$/i, '')
            .replace(/\s+CX\s*$/i, '')
            .replace(/^CAIXA\s+/i, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();

    /** Mesma regra do Hub (cadastro / tabela PROMOCAO). */
    const nomeGrupoPromoCatalogo = (value) => {
        let limpo = String(value || '').trim();
        const idx = limpo.search(MARCADOR_EMBALAGEM_NOME);
        if (idx > 0) limpo = limpo.slice(0, idx).trim();
        limpo = limpo.replace(SUFIXO_C_BARRA, '').trim();
        return normalizeName(limpo || value);
    };

    const normalizeSku = (value) => String(value || '').trim().toLowerCase();

    const productSku = (product) => normalizeSku(product?.sku);

    const isIndefinidoSku = (sku) => !sku || sku === 'indefinido';

    const preferVarejoItem = (hits = []) => {
        if (hits.length <= 1) return hits[0] || null;
        const unHit = hits.find((item) => /\bUN\b/i.test(item.product?.name || ''));
        if (unHit) return unHit;
        const nonCxHit = hits.find((item) => !/\bC\/\d+\b/i.test(item.product?.name || '') && !/\bCX\b/i.test(item.product?.name || ''));
        if (nonCxHit) return nonCxHit;
        return hits[0];
    };

    const resolveDisplayItem = (promo, catalogItems = []) => {
        const hubProductId = String(promo.hubProductId || promo.produtoId || '').trim();
        const sku = normalizeSku(promo.sku);
        const catalogId = String(promo.catalogProductId || '').trim().toLowerCase();
        const promoName = normalizeName(promo.name || promo.hubProductName);

        if (hubProductId) {
            const hit = catalogItems.find((item) => String(item.product?.hubId || '').trim() === hubProductId);
            if (hit) return hit;
        }

        if (!isIndefinidoSku(sku)) {
            const skuHits = catalogItems.filter((item) => productSku(item.product) === sku);
            const hit = preferVarejoItem(skuHits);
            if (hit) return hit;
        }

        if (catalogId) {
            const hit = catalogItems.find((item) => String(item.product?.id || '').toLowerCase() === catalogId);
            if (hit) return hit;

            for (const item of catalogItems) {
                const group = item.group || null;
                const product = item.product;
                if (!group) continue;
                if (group.primaryId === catalogId) return item;
                if (group.variants) {
                    for (const variant of Object.values(group.variants)) {
                        if (variant?.id === catalogId) return item;
                    }
                }
                if (product?.id === catalogId) return item;
            }
        }

        if (promoName) {
            const exactHits = catalogItems.filter((item) => normalizeName(item.product?.name) === promoName);
            const hit = preferVarejoItem(exactHits);
            if (hit) return hit;
        }

        return null;
    };

    const buildPromoEntries = (promocoes, catalogItems, { matchedOnly = false } = {}) => {
        const entries = (promocoes || []).map((promo, index) => ({
            promo,
            item: resolveDisplayItem(promo, catalogItems),
            hubIndex: index,
        }));
        const filtered = matchedOnly ? entries.filter((e) => e.item) : entries;
        return filtered.sort((a, b) => a.hubIndex - b.hubIndex);
    };

    const normalizePromoUnit = (value) => {
        const unit = String(value || 'UN').trim().toUpperCase();
        if (unit === 'CX' || unit === 'FD') return 'CX';
        if (unit === 'PL' || unit === 'PLT') return 'PL';
        return 'UN';
    };

    const tierForPromoUnit = (unit) => {
        if (unit === 'CX') return 'caixa';
        if (unit === 'PL') return 'pallet';
        return 'unidade';
    };

    const promoGroupKey = (promo) => {
        const family = String(promo?.hubFamilyId || '').trim();
        if (family) return `family:${family}`;
        const nome = nomeGrupoPromoCatalogo(promo?.name || promo?.hubProductName || '');
        return nome || String(promo?.hubProductId || promo?.id || '').trim();
    };

    const collapsePromoDuplicateUnits = (entries = [], { preferUnit = 'CX' } = {}) => {
        const grupos = agruparPromocoesTotem(entries);
        return grupos
            .map((grupo) => {
                const unit =
                    preferUnit && grupo.byUnit?.[preferUnit]
                        ? preferUnit
                        : unidadePadraoPromoGrupo(grupo);
                return entryAtivoPromoGrupo(grupo, unit);
            })
            .filter(Boolean);
    };

    const synthesizePromoDisplayItem = (promo, catalogItem) => {
        if (catalogItem) return catalogItem;
        const unit = normalizePromoUnit(promo?.unidade);
        const id = String(promo?.catalogProductId || promo?.hubProductId || promo?.id || '').trim();
        if (!id) return null;
        return {
            product: {
                id: promo.catalogProductId || id,
                hubId: String(promo.hubProductId || '').trim(),
                sku: String(promo.sku || '').trim(),
                name: String(promo.name || promo.hubProductName || 'Promoção').trim(),
                price: Number(promo.originalPrice ?? promo.promoPrice ?? 0) || 0,
                image: promo.imageUrl || '',
                unidade: unit,
                fatorMultiplicacao: Number(promo.fatorMultiplicacao) || 1,
            },
            group: null,
            categoryId: '',
            categoryName: '',
            defaultTier: tierForPromoUnit(unit),
        };
    };

    const enrichPromoEntry = (entry, catalogItems = []) => {
        const item = entry.item || resolveDisplayItem(entry.promo, catalogItems);
        const resolved = synthesizePromoDisplayItem(entry.promo, item);
        return { ...entry, item: resolved };
    };

    const agruparPromocoesTotem = (entries = []) => {
        const map = new Map();
        const order = new Map();

        entries.forEach((entry, index) => {
            const key = promoGroupKey(entry.promo);
            if (!key) return;
            if (!order.has(key)) order.set(key, index);
            const list = map.get(key);
            if (list) list.push(entry);
            else map.set(key, [entry]);
        });

        return [...map.entries()]
            .map(([chave, lista]) => {
                const byUnit = {};
                lista.forEach((entry) => {
                    const unit = normalizePromoUnit(entry.promo?.unidade);
                    byUnit[unit] = entry;
                });
                const unidadesDisponiveis = ['UN', 'CX', 'PL'].filter((unit) => byUnit[unit]);
                const principal = byUnit.UN || byUnit.CX || byUnit.PL || lista[0];
                return {
                    chave,
                    nomeExibicao: nomeGrupoPromoCatalogo(
                        principal?.promo?.name || principal?.promo?.hubProductName || chave,
                    ),
                    byUnit,
                    unidadesDisponiveis,
                    multiplo: unidadesDisponiveis.length > 1,
                    hubIndex: order.get(chave) ?? 0,
                };
            })
            .sort((a, b) => a.hubIndex - b.hubIndex);
    };

    const unidadePadraoPromoGrupo = (grupo) => {
        if (grupo?.byUnit?.UN) return 'UN';
        return grupo?.unidadesDisponiveis?.[0] || 'UN';
    };

    const entryAtivoPromoGrupo = (grupo, unit) =>
        grupo?.byUnit?.[unit] || grupo?.byUnit?.[grupo.unidadesDisponiveis?.[0]] || null;

    const rotuloUnidadePromoTotem = (unit) => {
        if (unit === 'CX') return 'Caixa';
        if (unit === 'PL') return 'Pallet';
        return 'Unidade';
    };

    const tagEmbalagemPromoTotem = (unit) => {
        if (unit === 'UN') return 'UNIDADE';
        if (unit === 'CX') return 'Caixa';
        if (unit === 'PL') return 'Pallet';
        return null;
    };

    const formatValidade = (promo) => {
        const iso = String(promo?.validTo || '').slice(0, 10);
        if (!iso) return 'Oferta por tempo limitado';
        const parts = iso.split('-').map(Number);
        const y = parts[0];
        const m = parts[1];
        const d = parts[2];
        if (!y || !m || !d) return 'Oferta por tempo limitado';
        const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
        return `Até ${d} de ${meses[m - 1]}.`;
    };

    const createHubPromoLoader = (apiUrl = '/api/promocoes') => {
        let hubPromos = [];
        let promosLoadedAt = 0;
        let fetchError = false;

        const load = async (force = false) => {
            const now = Date.now();
            if (!force && hubPromos.length && now - promosLoadedAt < CACHE_MS) {
                fetchError = false;
                return hubPromos;
            }
            try {
                const fetchUrl = force
                    ? `${apiUrl}${apiUrl.includes('?') ? '&' : '?'}sync=${Date.now()}`
                    : apiUrl;
                const res = await fetch(fetchUrl, {
                    credentials: 'same-origin',
                    cache: 'no-store',
                    headers: force ? { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } : undefined,
                });
                if (!res.ok) throw new Error('fetch failed');
                const data = await res.json();
                hubPromos = Array.isArray(data?.promocoes) ? data.promocoes : [];
                promosLoadedAt = now;
                fetchError = false;
            } catch {
                fetchError = true;
                if (!hubPromos.length) hubPromos = [];
            }
            return hubPromos;
        };

        return {
            load,
            hadError: () => fetchError,
            clear: () => {
                hubPromos = [];
                promosLoadedAt = 0;
                fetchError = false;
            },
        };
    };

    window.LigeirinhoPromoCatalog = {
        CACHE_MS,
        normalizeName,
        normalizeSku,
        productSku,
        resolveDisplayItem,
        buildPromoEntries,
        normalizePromoUnit,
        tierForPromoUnit,
        synthesizePromoDisplayItem,
        enrichPromoEntry,
        nomeGrupoPromoCatalogo,
        agruparPromocoesTotem,
        collapsePromoDuplicateUnits,
        unidadePadraoPromoGrupo,
        entryAtivoPromoGrupo,
        rotuloUnidadePromoTotem,
        tagEmbalagemPromoTotem,
        formatValidade,
        createHubPromoLoader,
    };
})();
