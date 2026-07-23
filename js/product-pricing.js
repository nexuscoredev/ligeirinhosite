(function () {
    /** Embalagens: UN (unidade), CX (caixa), PL (pallet). C/N permanece como caixa legada. */
    const PACK_C_SLASH_RE = /\s+C\/(\d+)\s*$/i;
    const PACK_CX_RE = /\s+CX(?:\s+(\d+))?\s*$/i;
    const PACK_PL_RE = /\s+PL(?:\s+(\d+))?\s*$/i;
    const PACK_UN_RE = /\s+UN(?:\s+(\d+))?\s*$/i;
    const PACK_PCT_C_SLASH_UN_RE = /\s+PCT\s+C\/\s*(\d+)\s+UN\s*$/i;
    const CAIXA_PREFIX_RE = /^CAIXA\s+/i;
    const PACKAGING_WORDS_RE = /\b(LATA|LONG\s*NECK|LN|GFA|GARRAFA|RET(?:ORN[AÁ]VEL)?)\b/gi;
    /** Agrupamento: não remove RETORNÁVEL — evita misturar garrafa com retornável no mesmo card. */
    const GROUP_PACKAGING_WORDS_RE = /\b(LATA|LONG\s*NECK|LN|GFA|GARRAFA)\b/gi;
    const OPTIONAL_BEER_WORDS_RE = /\b(HELLS)\b/gi;

    /** Parceiros e Totem: UN, CX e PL quando cadastrados no Hub. */
    const WHOLESALE_TIERS = ['unidade', 'caixa', 'pallet'];

    /** Nomes equivalentes no catálogo (unidade vs caixa com nome abreviado). */
    const GROUP_NAME_ALIASES = {
        'ORIGINAL 269ML': 'ANTARCTICA ORIGINAL 269ML',
    };

    const TIER_LABELS = {
        unidade: 'Unidade',
        caixa: 'Caixa',
        pallet: 'Pallet',
    };

    const TIER_SHORT = {
        unidade: 'Un.',
        caixa: 'CX',
        pallet: 'PL',
    };

    const stripPackSuffix = (name) =>
        String(name || '')
            .replace(PACK_PCT_C_SLASH_UN_RE, '')
            .replace(PACK_C_SLASH_RE, '')
            .replace(PACK_CX_RE, '')
            .replace(PACK_PL_RE, '')
            .replace(PACK_UN_RE, '')
            .replace(CAIXA_PREFIX_RE, '')
            .trim();

    const packSizeFromProduct = (product, nameHint = 1) => {
        const fator = Number(product?.fatorMultiplicacao ?? product?.fator_multiplicacao);
        if (Number.isFinite(fator) && fator > 0) return fator;
        const hint = Number(nameHint);
        return Number.isFinite(hint) && hint > 0 ? hint : 1;
    };

    /**
     * Classifica embalagem. Preferência: campo `unidade` do Hub (CX/PL/UN).
     * Sem unidade, cai no sufixo do nome (C/12, CX, PL, UN, prefixo CAIXA).
     */
    const parsePack = (nameOrProduct, maybeProduct) => {
        const product =
            maybeProduct && typeof maybeProduct === 'object'
                ? maybeProduct
                : nameOrProduct && typeof nameOrProduct === 'object'
                  ? nameOrProduct
                  : null;
        const rawName = product
            ? String(product.name || nameOrProduct || '').trim()
            : String(nameOrProduct || '').trim();

        const unidade = String(product?.unidade || product?.unit || '')
            .trim()
            .toUpperCase();
        if (unidade === 'PL' || unidade === 'PLT' || unidade === 'PALLET') {
            return { type: 'pallet', packSize: packSizeFromProduct(product, 1) };
        }
        if (unidade === 'CX' || unidade === 'FD' || unidade === 'PC' || unidade === 'FARDO') {
            return { type: 'caixa', packSize: packSizeFromProduct(product, 1) };
        }
        if (unidade === 'UN') {
            return { type: 'unidade', packSize: 1 };
        }

        let match = rawName.match(PACK_PL_RE);
        if (match) return { type: 'pallet', packSize: packSizeFromProduct(product, parseInt(match[1], 10) || 1) };

        match = rawName.match(PACK_UN_RE);
        if (match) return { type: 'unidade', packSize: 1 };

        match = rawName.match(PACK_CX_RE);
        if (match) return { type: 'caixa', packSize: packSizeFromProduct(product, parseInt(match[1], 10) || 1) };

        match = rawName.match(PACK_C_SLASH_RE);
        if (match) return { type: 'caixa', packSize: packSizeFromProduct(product, parseInt(match[1], 10) || 1) };

        if (CAIXA_PREFIX_RE.test(rawName)) {
            return { type: 'caixa', packSize: packSizeFromProduct(product, 1) };
        }

        // Sem unidade do Hub e sem sufixo no nome: trata como unidade.
        return { type: 'unidade', packSize: 1 };
    };

    const isCaixaPack = (pack) => pack?.type === 'caixa';
    const isUnidadePack = (pack) => pack?.type === 'unidade';
    const isPalletPack = (pack) => pack?.type === 'pallet';

    const packVariantFromProduct = (product, pack, cat) => {
        const tier = pack?.type === 'unidade' ? 'unidade' : 'caixa';
        const unidade =
            product.unidade ||
            (tier === 'unidade' ? 'UN' : 'CX');
        return {
            key: `${cat.id}::${product.id}`,
            baseName: stripPackSuffix(product.name),
            categoryId: cat.id,
            categoryName: cat.name,
            image: product.image,
            adultOnly: product.adultOnly,
            description: product.description,
            primaryId: product.id,
            variants: {
                [tier]: {
                    id: product.id,
                    hubId: product.hubId || null,
                    sku: product.sku || null,
                    name: product.name,
                    price: product.price,
                    packSize: pack.packSize,
                    adultOnly: product.adultOnly,
                    image: product.image,
                    unidade,
                },
            },
        };
    };

    const caixaVariantFromProduct = (product, pack, cat) =>
        packVariantFromProduct(product, pack || { type: 'caixa', packSize: 1 }, cat);

    const normalizeKey = (name, categoryId) => {
        let base = stripPackSuffix(name).replace(GROUP_PACKAGING_WORDS_RE, ' ');
        if (categoryId === 'cervejas') {
            base = base.replace(/^CERVEJA\s+/i, '').replace(OPTIONAL_BEER_WORDS_RE, ' ');
            base = base.replace(/\s+/g, ' ').trim().toUpperCase();
            if (GROUP_NAME_ALIASES[base]) base = GROUP_NAME_ALIASES[base];
        } else {
            base = base.replace(/\s+/g, ' ').trim();
        }
        return base
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();
    };

    const buildGroups = (catalogData) => {
        const groups = new Map();

        catalogData.categories.forEach((cat) => {
            cat.products.forEach((product) => {
                const pack = parsePack(product);
                const key = `${cat.id}::${normalizeKey(product.name, cat.id)}`;

                if (!groups.has(key)) {
                    groups.set(key, {
                        key,
                        baseName: stripPackSuffix(product.name),
                        categoryId: cat.id,
                        categoryName: cat.name,
                        image: product.image,
                        adultOnly: product.adultOnly,
                        description: product.description,
                        variants: {},
                        primaryId: product.id,
                    });
                }

                const group = groups.get(key);
                group.variants[pack.type] = {
                    id: product.id,
                    hubId: product.hubId || null,
                    sku: product.sku || null,
                    name: product.name,
                    price: product.price,
                    packSize: pack.packSize,
                    adultOnly: product.adultOnly,
                    image: product.image,
                    unidade: product.unidade || null,
                };

                if (pack.type === 'caixa') {
                    group.primaryId = product.id;
                    group.baseName = stripPackSuffix(product.name);
                    group.image = product.image;
                    group.adultOnly = product.adultOnly;
                } else if (pack.type === 'unidade' && !group.variants.caixa && !group.variants.pallet) {
                    group.primaryId = product.id;
                    group.baseName = stripPackSuffix(product.name);
                    group.image = product.image;
                    group.adultOnly = product.adultOnly;
                } else if (pack.type === 'pallet' && !group.variants.caixa) {
                    group.primaryId = product.id;
                    group.baseName = stripPackSuffix(product.name);
                    group.image = product.image;
                    group.adultOnly = product.adultOnly;
                }

                if (!group.image && product.image) group.image = product.image;
            });
        });

        enrichPalletVariants(groups);
        applyTierImages(groups, window.__ligTierImages || {});

        return groups;
    };

    /** PL: fator Hub = caixas no pallet; packSize interno = UN totais (cx × un/cx). */
    const enrichPalletVariants = (groups) => {
        groups.forEach((group) => {
            const pallet = group.variants?.pallet;
            if (!pallet) return;
            const caixas = Math.max(1, Number(pallet.packSize) || 1);
            const cx = group.variants?.caixa;
            const unPerCx = cx ? Math.max(1, Number(cx.packSize) || 1) : 1;
            pallet.boxCount = caixas;
            pallet.unitsPerBox = unPerCx;
            pallet.totalUnits = caixas * unPerCx;
            pallet.packSize = pallet.totalUnits;
        });
    };

    const matchBrand = (baseName, byBrand = {}) => {
        const upper = String(baseName || '').toUpperCase();
        for (const brand of Object.keys(byBrand)) {
            if (upper.includes(brand.toUpperCase())) return byBrand[brand];
        }
        return null;
    };

    const resolveTierImageOverride = (group, tier, config = {}) => {
        const byKey = config.byGroupKey?.[group.key]?.[tier];
        if (byKey) return byKey;
        const brand = matchBrand(group.baseName, config.byBrand);
        if (brand?.[tier]) return brand[tier];
        return config.defaults?.[tier] || null;
    };

    const applyTierImages = (groups, config) => {
        const isHubProductImage = (url) =>
            typeof url === 'string' &&
            (url.includes('produtos-imagens') || url.includes('supabase.co/storage'));

        groups.forEach((group) => {
            const variant = group.variants.caixa;
            if (!variant) return;
            const override = resolveTierImageOverride(group, 'caixa', config);
            if (override && !isHubProductImage(variant.image)) variant.image = override;
            if (group.variants.caixa?.image) group.image = group.variants.caixa.image;
            else if (group.variants.unidade?.image) group.image = group.variants.unidade.image;
        });
    };

    const getTierImage = (group, tier) => {
        if (!group) return null;
        const variant = group.variants?.[tier];
        if (variant?.image) return variant.image;
        if (tier === 'unidade') return group.image;
        if (tier === 'caixa') return group.variants?.caixa?.image || group.image;
        return group.image;
    };

    const tierHasPrice = (variant) => {
        if (!variant || variant.price == null) return false;
        const price = Number(variant.price);
        return Number.isFinite(price) && price > 0;
    };

    const getAvailableTiers = (group) =>
        WHOLESALE_TIERS.filter((tier) => tierHasPrice(group?.variants?.[tier]));

    const getDefaultTier = (group) => {
        const tiers = getAvailableTiers(group);
        if (tiers.includes('caixa')) return 'caixa';
        if (tiers.includes('unidade')) return 'unidade';
        if (tiers.includes('pallet')) return 'pallet';
        return tiers[0] || 'caixa';
    };

    const resolveActiveTier = (group, preferred) => {
        const tiers = getAvailableTiers(group);
        if (preferred && tiers.includes(preferred)) return preferred;
        return getDefaultTier(group);
    };

    const getVariant = (group, tier) => {
        const variant = group?.variants?.[tier];
        if (!variant) return null;
        return { ...variant, tier, tierLabel: TIER_LABELS[tier] || tier };
    };

    /**
     * Parceiros e Totem: um card por produto agrupado (UN + CX + PL no mesmo card).
     * Respeita venda_parceiros do Hub (checkbox "Totem | Parceiros").
     */
    const buildCatalogDisplayProducts = (catalogData, groupsMap = null) => {
        const groups = groupsMap || buildGroups(catalogData);
        const items = [];
        const seen = new Set();

        catalogData.categories.forEach((cat) => {
            const groupKeys = new Set();
            (cat.products || []).forEach((product) => {
                if (product.vendaParceiros === false) return;
                const price = Number(product.price);
                if (!Number.isFinite(price) || price <= 0) return;
                const pack = parsePack(product);
                if (!isCaixaPack(pack) && !isUnidadePack(pack) && !isPalletPack(pack)) return;
                groupKeys.add(`${cat.id}::${normalizeKey(product.name, cat.id)}`);
            });

            groupKeys.forEach((key) => {
                if (seen.has(key)) return;
                const group = groups.get(key);
                if (!group) return;
                const availableTiers = getAvailableTiers(group);
                if (!availableTiers.length) return;
                const defaultTier = getDefaultTier(group);
                if (!defaultTier || !availableTiers.includes(defaultTier)) return;

                const primary =
                    group.variants[defaultTier] ||
                    group.variants.caixa ||
                    group.variants.unidade ||
                    group.variants.pallet;
                if (!primary) return;
                seen.add(key);
                items.push({
                    group,
                    product: {
                        id: primary.id,
                        hubId: primary.hubId,
                        sku: primary.sku,
                        name: group.baseName,
                        price: primary.price,
                        image: group.image || primary.image,
                        adultOnly: group.adultOnly ?? primary.adultOnly,
                        description: group.description || primary.description,
                        unidade:
                            primary.unidade ||
                            (defaultTier === 'unidade'
                                ? 'UN'
                                : defaultTier === 'pallet'
                                  ? 'PL'
                                  : 'CX'),
                    },
                    categoryName: group.categoryName || cat.name,
                    categoryId: group.categoryId || cat.id,
                    defaultTier,
                });
            });
        });

        return items;
    };

    const getDisplayProducts = (catalogData, groupsMap = null) =>
        buildCatalogDisplayProducts(catalogData, groupsMap);

    const getTotemDisplayProducts = (catalogData, groupsMap = null) =>
        buildCatalogDisplayProducts(catalogData, groupsMap);

    const getTotemAvailableTiers = getAvailableTiers;
    const getTotemDefaultTier = getDefaultTier;

    const getUnitPrice = (variant) => {
        if (!variant || variant.price == null) return null;
        const units = Number(variant.packSize) || 0;
        if (units > 1) return Math.round((variant.price / units) * 100) / 100;
        return variant.price;
    };

    const pricePackMeta = (variant) => {
        if (!variant) {
            return { unitPrice: null, packagePrice: null, tierLabel: '', detail: '', unitSuffix: 'por unidade' };
        }

        const tierLabel = TIER_LABELS[variant.tier] || variant.tier || '';
        const unitPrice = getUnitPrice(variant);
        const packagePrice = variant.price;

        if (variant.tier === 'caixa') {
            const size = Number(variant.packSize) || 0;
            return {
                unitPrice,
                packagePrice,
                tierLabel,
                detail: size > 1 ? `CX c/ ${size} un` : 'CX',
                unitSuffix: 'por unidade',
            };
        }

        if (variant.tier === 'pallet') {
            const boxes = Number(variant.boxCount) || 0;
            const unCx = Number(variant.unitsPerBox) || 0;
            const size = Number(variant.packSize) || 0;
            let detail = 'PL';
            if (boxes > 1 && unCx > 1) detail = `PL · ${boxes} cx × ${unCx} un`;
            else if (boxes > 1) detail = `PL c/ ${boxes} cx`;
            else if (size > 1) detail = `PL c/ ${size}`;
            return {
                unitPrice,
                packagePrice,
                tierLabel,
                detail,
                unitSuffix: 'por unidade',
            };
        }

        return {
            unitPrice,
            packagePrice,
            tierLabel,
            detail: tierLabel,
            unitSuffix: 'por unidade',
        };
    };

    const packLineLabel = (variant) => {
        const meta = pricePackMeta(variant);
        if (!meta.detail) return meta.unitSuffix;
        return `${meta.unitSuffix} · ${meta.detail}`;
    };

    const cartItemName = (variant, group) => {
        const base = group?.baseName || variant.name;
        if (variant.tier === 'unidade') return base;
        if (variant.tier === 'caixa') {
            const size = Number(variant.packSize) || 0;
            return size > 1 ? `${base} (CX c/ ${size})` : `${base} (CX)`;
        }
        if (variant.tier === 'pallet') {
            const boxes = Number(variant.boxCount) || 0;
            const unCx = Number(variant.unitsPerBox) || 0;
            if (boxes > 1 && unCx > 1) return `${base} (PL · ${boxes} cx × ${unCx} un)`;
            const size = boxes > 1 ? boxes : Number(variant.packSize) || 0;
            return size > 1 ? `${base} (PL c/ ${size})` : `${base} (PL)`;
        }
        return variant.name;
    };

    window.LigeirinhoPricing = {
        TIER_LABELS,
        TIER_SHORT,
        WHOLESALE_TIERS,
        buildGroups,
        getAvailableTiers,
        getDefaultTier,
        resolveActiveTier,
        getVariant,
        getDisplayProducts,
        getTotemDisplayProducts,
        getTotemAvailableTiers,
        getTotemDefaultTier,
        packLineLabel,
        getUnitPrice,
        pricePackMeta,
        cartItemName,
        parsePack,
        loadPackConfig: () => {
            if (window.__ligPackConfig) return Promise.resolve(window.__ligPackConfig);
            return fetch('data/precos-embalagem.json')
                .then((r) => (r.ok ? r.json() : {}))
                .catch(() => ({}))
                .then((cfg) => {
                    window.__ligPackConfig = cfg;
                    return cfg;
                });
        },
        loadTierImages: () => {
            if (window.__ligTierImages) return Promise.resolve(window.__ligTierImages);
            return fetch('data/imagem-embalagem.json')
                .then((r) => (r.ok ? r.json() : {}))
                .catch(() => ({}))
                .then((cfg) => {
                    window.__ligTierImages = cfg;
                    return cfg;
                });
        },
        applyTierImages,
        getTierImage,
        rebuildGroups: (catalogData) => {
            const groups = buildGroups(catalogData);
            window.__ligProductGroups = groups;
            return groups;
        },
    };
})();
