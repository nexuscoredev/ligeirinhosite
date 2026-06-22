(function () {
    const PACK_SUFFIX_RE = /\s+C\/(\d+)\s*$/i;
    const CX_SUFFIX_RE = /\s+CX\s*$/i;
    const CAIXA_PREFIX_RE = /^CAIXA\s+/i;
    const PACKAGING_WORDS_RE = /\b(LATA|LONG\s*NECK|LN|GFA|GARRAFA|RET(?:ORN[AÁ]VEL)?)\b/gi;
    const OPTIONAL_BEER_WORDS_RE = /\b(HELLS)\b/gi;

    /** Parceiros: somente caixa e pallet (sem venda por unidade). */
    const WHOLESALE_TIERS = ['caixa', 'pallet'];

    /** Nomes equivalentes no catálogo (unidade vs caixa com nome abreviado). */
    const GROUP_NAME_ALIASES = {
        'ORIGINAL 269ML': 'ANTARCTICA ORIGINAL 269ML',
    };

    const PALLET_CONFIG = {
        boxesPerPallet: 48,
        discount: 0.92,
    };

    const TIER_LABELS = {
        unidade: 'Unidade',
        caixa: 'Caixa',
        pallet: 'Pallet',
    };

    const TIER_SHORT = {
        unidade: 'Un.',
        caixa: 'Caixa',
        pallet: 'Pallet',
    };

    const stripPackSuffix = (name) =>
        String(name || '')
            .replace(PACK_SUFFIX_RE, '')
            .replace(CX_SUFFIX_RE, '')
            .replace(CAIXA_PREFIX_RE, '')
            .trim();

    const parsePack = (name) => {
        const raw = String(name || '').trim();
        const match = raw.match(PACK_SUFFIX_RE);
        if (match) return { type: 'caixa', packSize: parseInt(match[1], 10) || 1 };
        if (CX_SUFFIX_RE.test(raw) || CAIXA_PREFIX_RE.test(raw)) {
            return { type: 'caixa', packSize: 1 };
        }
        return { type: 'unidade', packSize: 1 };
    };

    const normalizeKey = (name, categoryId) => {
        let base = stripPackSuffix(name).replace(PACKAGING_WORDS_RE, ' ');
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
                const pack = parsePack(product.name);
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
                    name: product.name,
                    price: product.price,
                    packSize: pack.packSize,
                    adultOnly: product.adultOnly,
                    image: product.image,
                };

                if (pack.type === 'caixa') {
                    group.primaryId = product.id;
                    group.baseName = stripPackSuffix(product.name);
                    group.image = product.image;
                    group.adultOnly = product.adultOnly;
                } else if (pack.type === 'unidade' && !group.variants.caixa) {
                    group.primaryId = product.id;
                    group.baseName = stripPackSuffix(product.name);
                    group.image = product.image;
                    group.adultOnly = product.adultOnly;
                }

                if (!group.image && product.image) group.image = product.image;
            });
        });

        groups.forEach((group) => {
            const caixa = group.variants.caixa;

            if (caixa && !group.variants.pallet) {
                const cfg = { ...PALLET_CONFIG, ...window.__ligPackConfig };
                const boxes = cfg.boxesPerPallet;
                const unitsInPallet = boxes * (caixa.packSize || 1);
                group.variants.pallet = {
                    id: caixa.id,
                    name: `${group.baseName} — Pallet (${boxes} cx)`,
                    price: Math.round(caixa.price * boxes * cfg.discount * 100) / 100,
                    packSize: unitsInPallet,
                    boxCount: boxes,
                    computed: true,
                    adultOnly: caixa.adultOnly,
                    image: caixa.image,
                };
            }
        });

        applyTierImages(groups, window.__ligTierImages || {});

        return groups;
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
        groups.forEach((group) => {
            ['caixa', 'pallet'].forEach((tier) => {
                const variant = group.variants[tier];
                if (!variant) return;
                const override = resolveTierImageOverride(group, tier, config);
                if (override) variant.image = override;
                else if (tier === 'pallet' && config.defaults?.pallet) variant.image = config.defaults.pallet;
            });
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
        if (tier === 'pallet') {
            return (
                group.variants?.pallet?.image ||
                resolveTierImageOverride(group, 'pallet', window.__ligTierImages || {}) ||
                group.variants?.caixa?.image ||
                group.image
            );
        }
        return group.image;
    };

    const getAvailableTiers = (group) =>
        WHOLESALE_TIERS.filter((tier) => group?.variants?.[tier]?.price != null);

    const getDefaultTier = (group) => {
        const tiers = getAvailableTiers(group);
        if (tiers.includes('caixa')) return 'caixa';
        return tiers[0] || 'caixa';
    };

    const getVariant = (group, tier) => {
        const variant = group?.variants?.[tier];
        if (!variant) return null;
        return { ...variant, tier, tierLabel: TIER_LABELS[tier] || tier };
    };

    const getDisplayProducts = (catalogData, groupsMap = null) => {
        const groups = groupsMap || buildGroups(catalogData);
        const items = [];
        const seen = new Set();

        catalogData.categories.forEach((cat) => {
            cat.products.forEach((product) => {
                const pack = parsePack(product.name);
                if (pack.type === 'unidade') return;

                const key = `${cat.id}::${normalizeKey(product.name, cat.id)}`;
                if (seen.has(key)) return;

                const group = groups.get(key);
                if (!group) return;

                const tiers = getAvailableTiers(group);
                if (!tiers.length) return;

                seen.add(key);
                const defaultTier = getDefaultTier(group);

                items.push({
                    group,
                    product: {
                        id: group.primaryId,
                        name: group.baseName,
                        price: getVariant(group, defaultTier)?.price ?? product.price,
                        image: group.image,
                        adultOnly: group.adultOnly,
                        description: group.description,
                    },
                    categoryName: cat.name,
                    categoryId: cat.id,
                });
            });
        });

        return items;
    };

    const getTotemDefaultTier = (group) => {
        const tiers = getAvailableTiers(group);
        if (tiers.includes('caixa')) return 'caixa';
        return tiers[0] || null;
    };

    /** Totem: somente caixa e pallet (sem venda por unidade). */
    const getTotemDisplayProducts = (catalogData, groupsMap = null) => {
        const groups = groupsMap || buildGroups(catalogData);
        const items = [];
        const seen = new Set();

        catalogData.categories.forEach((cat) => {
            const groupKeys = new Set();
            cat.products.forEach((product) => {
                const pack = parsePack(product.name);
                if (pack.type === 'unidade') return;
                groupKeys.add(`${cat.id}::${normalizeKey(product.name, cat.id)}`);
            });

            groupKeys.forEach((key) => {
                const group = groups.get(key);
                if (!group) return;

                getAvailableTiers(group).forEach((defaultTier) => {
                    const itemKey = `${key}::${defaultTier}`;
                    if (seen.has(itemKey)) return;
                    seen.add(itemKey);

                    const variant = getVariant(group, defaultTier);
                    if (!variant) return;

                    items.push({
                        group,
                        product: {
                            id: group.primaryId,
                            name: group.baseName,
                            price: variant.price,
                            image: getTierImage(group, defaultTier),
                            adultOnly: group.adultOnly,
                            description: group.description,
                        },
                        categoryName: cat.name,
                        categoryId: cat.id,
                        defaultTier,
                    });
                });
            });
        });

        return items;
    };

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
            return {
                unitPrice,
                packagePrice,
                tierLabel,
                detail: `Caixa c/ ${variant.packSize || '?'} un`,
                unitSuffix: 'por unidade',
            };
        }

        if (variant.tier === 'pallet') {
            const boxes = variant.boxCount ? `${variant.boxCount} cx` : '';
            return {
                unitPrice,
                packagePrice,
                tierLabel,
                detail: boxes ? `Pallet · ${boxes}` : 'Pallet',
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
        if (variant.tier === 'caixa') return `${base} (Caixa c/ ${variant.packSize})`;
        if (variant.tier === 'pallet') {
            const suffix = variant.boxCount ? `${variant.boxCount} cx` : 'atacado';
            return `${base} (Pallet · ${suffix})`;
        }
        return variant.name;
    };

    window.LigeirinhoPricing = {
        TIER_LABELS,
        TIER_SHORT,
        WHOLESALE_TIERS,
        PALLET_CONFIG,
        buildGroups,
        getAvailableTiers,
        getDefaultTier,
        getVariant,
        getDisplayProducts,
        getTotemDisplayProducts,
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
