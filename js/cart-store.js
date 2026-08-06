(function () {
    const CART_KEY = 'ligeirinho-cart-v1';
    const CHECKOUT_KEY = 'ligeirinho-checkout-v1';
    const LAST_ORDER_KEY = 'ligeirinho-last-order-v1';
    const PREFS_KEY = 'ligeirinho-prefs-v1';
    const ADDRESS_HISTORY_KEY = 'ligeirinho-address-history-v1';
    const SAVED_ADDRESSES_PREFIX = 'ligeirinho-saved-addresses-v1';
    const SAVED_ADDRESSES_MAX = 20;

    const getAddressUserKey = () => {
        try {
            const s = window.LigeirinhoAuth?.loadSession?.();
            return String(s?.hubUserId || s?.sub || 'guest').trim() || 'guest';
        } catch {
            return 'guest';
        }
    };

    const savedAddressesStorageKey = () => `${SAVED_ADDRESSES_PREFIX}:${getAddressUserKey()}`;

    const loadLegacyAddressHistory = () => {
        try {
            const list = JSON.parse(localStorage.getItem(ADDRESS_HISTORY_KEY) || '[]');
            return Array.isArray(list) ? list : [];
        } catch {
            return [];
        }
    };

    const migrateLegacyAddressHistory = () => {
        const key = savedAddressesStorageKey();
        try {
            if (localStorage.getItem(key)) return;
        } catch {
            return;
        }
        const legacy = loadLegacyAddressHistory();
        if (!legacy.length) return;
        try {
            localStorage.setItem(
                key,
                JSON.stringify(
                    legacy.map((item) => ({
                        ...item,
                        label: String(item.label || '').trim(),
                        savedAt: item.savedAt || item.usedAt || Date.now(),
                        usedAt: item.usedAt || Date.now(),
                    })),
                ),
            );
        } catch {
            /* quota / private mode */
        }
    };

    let cartCache = null;
    let persistTimer = null;

    const loadCart = () => {
        if (cartCache) return cartCache;
        try {
            cartCache = JSON.parse(localStorage.getItem(CART_KEY) || '{}');
        } catch {
            cartCache = {};
        }
        return cartCache;
    };

    const flushCart = () => {
        if (!cartCache) return;
        try {
            localStorage.setItem(CART_KEY, JSON.stringify(cartCache));
        } catch {
            /* quota / private mode */
        }
    };

    const saveCart = (cart) => {
        cartCache = cart;
        window.dispatchEvent(new CustomEvent('ligeirinho-cart-changed'));
        window.clearTimeout(persistTimer);
        persistTimer = window.setTimeout(flushCart, 60);
    };

    window.addEventListener('pagehide', flushCart);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushCart();
    });

    const defaultCheckout = () => ({
        deliveryType: 'entrega',
        address: '',
        payment: '',
        paymentMethod: '',
        paymentSplits: [],
        condicaoPagamento: '',
        deliveryDate: '',
        notes: '',
        editOrderId: '',
        orderTabelaPrecoId: '',
        orderTabelaPrecoCodigo: '',
        orderTabelaPrecoLabel: '',
        orderTaxaEntrega: null,
        orderClienteNome: '',
        orderClienteDoc: '',
        orderClienteTelefone: '',
        orderClienteAPrazo: false,
        cartClienteScope: '',
    });

    const loadCheckout = () => {
        try {
            return { ...defaultCheckout(), ...JSON.parse(localStorage.getItem(CHECKOUT_KEY) || '{}') };
        } catch {
            return defaultCheckout();
        }
    };

    const saveCheckout = (data) => {
        localStorage.setItem(CHECKOUT_KEY, JSON.stringify({ ...loadCheckout(), ...data }));
        window.dispatchEvent(new CustomEvent('ligeirinho-checkout-changed'));
    };

    const cartEntries = (cart) => Object.values(cart).filter((item) => item.qty > 0);

    const cartItemCount = (cart) => cartEntries(cart).reduce((sum, item) => sum + item.qty, 0);

    const cartTotalValue = (cart) =>
        cartEntries(cart).reduce((sum, item) => sum + (item.price ?? 0) * item.qty, 0);

    const formatMoney = (value) => {
        if (value == null || Number.isNaN(value)) return '—';
        return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const packTypeLabel = (packType) => {
        const t = String(packType || 'caixa').toLowerCase();
        if (t === 'unidade') return 'Unidade';
        if (t === 'pallet') return 'Pallet';
        return 'Caixa';
    };

    const packTypeFromCartKey = (cartKey, fallback = 'caixa') => {
        const match = String(cartKey || '').match(/::(unidade|caixa|pallet)$/i);
        return match ? match[1].toLowerCase() : String(fallback || 'caixa').toLowerCase();
    };

    /** Subtítulo de embalagem — nunca trata CX/PL como unidade avulsa. */
    const itemPackDetailText = (item) => {
        const tier = packTypeFromCartKey(item?.cartKey || item?.id, item?.packType || 'caixa');
        if (tier === 'unidade') {
            const boxMatch = String(item?.name || '').match(/\((?:Caixa|CX)\s*c\/\s*(\d+)\)/i);
            if (boxMatch) return `1 Unidade · Caixa contém ${boxMatch[1]} unidades`;
            return '1 Unidade · preço por unidade';
        }
        if (tier === 'pallet') return '1 Pallet · preço por embalagem';
        return '1 Caixa · preço por embalagem';
    };

    const itemPackPriceLabel = (item) => {
        const tier = packTypeFromCartKey(item?.cartKey || item?.id, item?.packType || 'caixa');
        if (tier === 'pallet') return 'por pallet';
        if (tier === 'caixa') return 'por caixa';
        return 'por unidade';
    };

    const lineSubtotal = (item) => (item.price ?? 0) * (item.qty || 0);

    const itemMetaText = (item) => {
        const unit = formatMoney(item.price ?? 0);
        const pack = packTypeLabel(item.packType);
        const sub = formatMoney(lineSubtotal(item));
        return `${item.qty}x ${unit}/${pack} · ${sub}`;
    };

    const cartSummary = (cart) => {
        const items = cartEntries(cart);
        const units = cartItemCount(cart);
        const subtotal = cartTotalValue(cart);
        return { items, units, subtotal, total: subtotal };
    };

    const promoFieldsFromItem = (item) => {
        const patch = {};
        if (item.promoId) patch.promoId = item.promoId;
        if (item.isPromo) patch.isPromo = true;
        if (item.originalPrice != null) patch.originalPrice = item.originalPrice;
        if (item.discountPct != null) patch.discountPct = item.discountPct;
        return patch;
    };

    const paymentCheckoutReset = () => ({
        payment: '',
        paymentMethod: '',
        paymentSplits: [],
    });

    /** Checkout do “pedir de novo”: mantém entrega/endereço, nunca a forma de pagamento. */
    const checkoutForReorder = (checkout) => {
        const raw = checkout && typeof checkout === 'object' ? checkout : {};
        const {
            payment: _p,
            paymentMethod: _pm,
            paymentSplits: _ps,
            editOrderId: _eo,
            editOrderMeta: _em,
            ...rest
        } = raw;
        return {
            ...defaultCheckout(),
            ...rest,
            ...paymentCheckoutReset(),
            editOrderId: '',
            editOrderMeta: undefined,
        };
    };

    const saveLastOrder = (cart, checkout, orderId = null) => {
        const items = cartEntries(cart);
        if (!items.length) return;
        try {
            localStorage.setItem(
                LAST_ORDER_KEY,
                JSON.stringify({
                    orderId: orderId ? String(orderId) : null,
                    items: items.map((item) => ({
                        id: item.id,
                        cartKey: item.cartKey || item.id,
                        name: item.name,
                        price: item.price,
                        qty: item.qty,
                        packType: item.packType,
                        image: item.image || '',
                        categoryId: item.categoryId || '',
                        categoryName: item.categoryName || '',
                        ...promoFieldsFromItem(item),
                    })),
                    // Não persiste divisão/pagamento — próximo pedido escolhe de novo.
                    checkout: checkoutForReorder(checkout || loadCheckout()),
                    savedAt: Date.now(),
                })
            );
        } catch {
            /* ignore */
        }
    };

    const loadLastOrder = () => {
        try {
            const data = JSON.parse(localStorage.getItem(LAST_ORDER_KEY) || 'null');
            if (!data?.items?.length) return null;
            return data;
        } catch {
            return null;
        }
    };

    const restoreLastOrder = () => {
        const data = loadLastOrder();
        if (!data?.items?.length) return false;
        const cart = {};
        data.items.forEach((item) => {
            const key = item.cartKey || item.id;
            cart[key] = { ...item, cartKey: key };
        });
        saveCart(cart);
        if (data.checkout) saveCheckout(checkoutForReorder(data.checkout));
        else saveCheckout(paymentCheckoutReset());
        return true;
    };

    /** Limpa forma de pagamento do checkout atual (após pedido ou ao iniciar fluxo novo). */
    const clearCheckoutPayment = () => {
        saveCheckout(paymentCheckoutReset());
    };

    const isDeliveryFeeCartItem = (item) => {
        if (!item) return false;
        if (item.isDeliveryFee === true) return true;
        const id = String(item.id || item.cartKey || '').toLowerCase();
        const sku = String(item.sku || '').trim();
        const hubId = String(item.hubId || '').toLowerCase();
        return id === 'taxa-entrega-hr' || sku === '1045' || hubId === '59af880d-0c08-4827-b2de-7ea5b10a6324';
    };

    const checkoutFromOrder = (order) => {
        const splitsApi = window.LigeirinhoPaymentSplits;
        const splits = splitsApi?.resolveOrderSplits?.(order) || [];
        const notes = String(order?.notes || '');
        const clienteMatch = notes.match(/Cliente:\s*([^·]+)/);
        const docMatch = notes.match(/Doc cliente:\s*([^·]+)/i);
        const aPrazoMatch = notes.match(/Cliente a prazo:\s*(sim|não|nao)/i);
        const tabelaMatch = notes.match(/Tabela:\s*([^·]+)/);
        const paymentMethod =
            splits.length === 1
                ? splits[0].method
                : String(order?.paymentMethod || order?.payment_method || '').toLowerCase();
        const deliveryFee = Number(order?.deliveryFee ?? order?.delivery_fee);
        const orderClienteDoc =
            String(order?.customerDoc || '').trim() ||
            (order?.customerCpf
                ? window.LigeirinhoCpf?.formatCpf?.(order.customerCpf) || String(order.customerCpf)
                : '') ||
            (order?.customerCnpj
                ? window.LigeirinhoCnpj?.formatCnpj?.(order.customerCnpj) || String(order.customerCnpj)
                : '') ||
            String(docMatch?.[1] || '').trim();
        return {
            editOrderId: String(order?.id || ''),
            editOrderMeta: {
                notes,
                status: order?.status || 'pending',
                financialStatus: order?.financialStatus || order?.financial_status || '',
                hubStatus: order?.tracking?.hubStatus || order?.hubStatus || '',
                channel: order?.channel || 'parceiros',
            },
            deliveryType: order?.deliveryType || order?.delivery_type || 'entrega',
            address: order?.address || '',
            deliveryDate: order?.deliveryDate || order?.delivery_date || '',
            paymentMethod: paymentMethod || '',
            paymentSplits: splits.length >= 2 ? splits : [],
            orderClienteNome: String(order?.customerName || order?.customer_name || clienteMatch?.[1]?.trim() || ''),
            orderClienteDoc,
            orderClienteTelefone: String(order?.customerPhone || order?.customer_phone || '').trim(),
            orderClienteAPrazo: aPrazoMatch ? /^sim$/i.test(String(aPrazoMatch[1] || '')) : false,
            cartClienteScope: String(
                order?.customerName || order?.customer_name || clienteMatch?.[1]?.trim() || '',
            ),
            orderTabelaPrecoCodigo: tabelaMatch?.[1]?.trim() || '',
            orderTabelaPrecoId: String(
                order?.orderTabelaPrecoId || order?.order_tabela_preco_id || '',
            ).trim(),
            orderTaxaEntrega: Number.isFinite(deliveryFee) && deliveryFee >= 0 ? deliveryFee : null,
            notes: '',
        };
    };

    const isEditingOrder = () => Boolean(String(loadCheckout().editOrderId || '').trim());

    /** Sai do modo edição (ex.: caminhão esvaziado → novo pedido). */
    const exitOrderEditMode = () => {
        if (!isEditingOrder()) return false;
        const checkout = loadCheckout();
        saveCheckout({
            editOrderId: '',
            editOrderMeta: undefined,
        });
        window.LigeirinhoCartPrice?.clearEditOrderPriceSnapshot?.();
        return Boolean(checkout.editOrderId);
    };

    const loadOrderIntoCart = (order, { lockPrices = false } = {}) => {
        const items = (Array.isArray(order?.items) ? order.items : []).filter(
            (item) => !isDeliveryFeeCartItem(item),
        );
        if (!items.length) return false;
        const cart = {};
        items.forEach((item) => {
            const key = item.cartKey || item.id;
            if (!key) return;
            const price = Number(item.price);
            const originalPrice = item.originalPrice != null ? Number(item.originalPrice) : null;
            const packType = packTypeFromCartKey(key, item.packType || 'caixa');
            cart[key] = {
                id: item.id || key,
                cartKey: key,
                name: item.name,
                price: Number.isFinite(price) ? price : 0,
                qty: Math.max(1, Number(item.qty) || 1),
                packType,
                image: item.image || '',
                categoryId: item.categoryId || '',
                categoryName: item.categoryName || '',
                hubId: item.hubId || item.hubProductId || '',
                sku: item.sku || '',
                ...(originalPrice != null && Number.isFinite(originalPrice) && originalPrice > 0
                    ? { listPrice: originalPrice }
                    : {}),
                ...(lockPrices ? { priceLocked: true } : {}),
                ...promoFieldsFromItem(item),
            };
        });
        saveCart(cart);
        saveLastOrder(cart, loadCheckout(), order?.id || null);
        return true;
    };

    const loadOrderForEdit = (order) => {
        if (!loadOrderIntoCart(order, { lockPrices: true })) return false;
        saveCheckout(checkoutFromOrder(order));
        window.LigeirinhoCartPrice?.snapshotEditOrderPrices?.(loadCart());
        return true;
    };

    /** Repete pedido no caminhão (novo pedido — sem modo edição, preços do catálogo). */
    const loadOrderForReorder = (order) => {
        if (!loadOrderIntoCart(order)) return false;
        exitOrderEditMode();
        const checkout = checkoutForReorder(checkoutFromOrder(order));
        if (checkout.orderClienteNome) {
            checkout.cartClienteScope = checkout.orderClienteNome;
        }
        saveCheckout(checkout);
        window.LigeirinhoCartPrice?.clearEditOrderPriceSnapshot?.();
        window.LigeirinhoCartPrice?.clearOrderTablePriceLookup?.();
        return true;
    };

    const normalizeLookupName = (name) =>
        String(name || '')
            .normalize('NFD')
            .replace(/\p{M}/gu, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();

    const resolveCartLineImage = (group, tier, variant) => {
        const pricing = window.LigeirinhoPricing;
        const catalog = window.LigeirinhoCatalog;
        const raw = pricing?.getTierImage?.(group, tier) || variant?.image || group?.image || '';
        return catalog?.productImageUrl?.(raw) || raw || '';
    };

    const buildCatalogLookupIndex = (catalogData) => {
        const pricing = window.LigeirinhoPricing;
        if (!pricing?.buildGroups || !catalogData?.categories?.length) return null;
        const index = new Map();
        const nameIndex = new Map();
        const groups = pricing.buildGroups(catalogData);

        const rememberName = (entry, label) => {
            const key = normalizeLookupName(label);
            if (key.length >= 4 && !nameIndex.has(key)) nameIndex.set(key, entry);
        };

        for (const group of groups.values()) {
            for (const tier of ['unidade', 'caixa', 'pallet']) {
                const variant = group.variants?.[tier];
                if (!variant?.id) continue;
                const cartKey = tier === 'unidade' ? variant.id : `${variant.id}::${tier}`;
                const entry = { group, tier, variant, cartKey };
                index.set(String(variant.id), entry);
                index.set(cartKey, entry);
                if (variant.hubId) index.set(String(variant.hubId), entry);
                if (variant.sku) index.set(String(variant.sku), entry);
                rememberName(entry, variant.name);
                rememberName(entry, group.baseName);
                rememberName(entry, pricing.cartItemName?.({ ...variant, tier }, group));
            }
        }
        return { index, nameIndex };
    };

    const findCatalogEntryForCartItem = (lookup, item) => {
        const index = lookup?.index || lookup;
        const nameIndex = lookup?.nameIndex;
        if (!index || !item) return null;
        const candidates = new Set(
            [item.cartKey, item.id, item.hubId, item.hubProductId, item.sku]
                .map((value) => String(value || '').trim())
                .filter(Boolean),
        );
        const cartKey = String(item.cartKey || '');
        if (cartKey.includes('::')) candidates.add(cartKey.split('::')[0]);
        for (const key of candidates) {
            const hit = index.get(key);
            if (!hit) continue;
            const tier = String(item.packType || hit.tier || 'caixa').toLowerCase();
            const variant = hit.group.variants?.[tier] || hit.variant;
            return { group: hit.group, tier, variant };
        }

        const nameKey = normalizeLookupName(item.name);
        if (nameKey && nameIndex?.has(nameKey)) {
            const hit = nameIndex.get(nameKey);
            const tier = String(item.packType || hit.tier || 'caixa').toLowerCase();
            const variant = hit.group.variants?.[tier] || hit.variant;
            return { group: hit.group, tier, variant };
        }
        return null;
    };

    const loadCatalogForEnrich = async () => {
        const checkout = loadCheckout();
        const tableId = String(checkout.orderTabelaPrecoId || '').trim();
        const tableCodigo = String(checkout.orderTabelaPrecoCodigo || '').trim();

        if (tableId || tableCodigo) {
            try {
                const headers = (await window.LigeirinhoAuth?.buildAccountHeaders?.()) || {};
                const params = new URLSearchParams({ sync: String(Date.now()) });
                if (tableId) params.set('tabelaPrecoId', tableId);
                else params.set('tabelaPrecoCodigo', tableCodigo);
                const res = await fetch(`/api/catalog/by-table?${params.toString()}`, {
                    credentials: 'same-origin',
                    headers,
                });
                if (res.ok) {
                    const catalog = await res.json();
                    if (catalog?.categories?.length) return catalog;
                }
            } catch {
                /* fallback para catálogo padrão */
            }
        }

        const loader = window.LigeirinhoCatalogLoader;
        if (!loader?.load) throw new Error('Catálogo indisponível');
        return loader.load({ force: false });
    };

    const enrichCartFromCatalog = (catalogData) => {
        const lookup = buildCatalogLookupIndex(catalogData);
        if (!lookup?.index) return false;
        const cart = loadCart();
        let changed = false;
        for (const key of Object.keys(cart)) {
            const item = cart[key];
            if (!item || item.isDeliveryFee) continue;
            const match = findCatalogEntryForCartItem(lookup, item);
            if (!match?.variant) continue;
            const { group, tier, variant } = match;
            const patch = {};
            const image = resolveCartLineImage(group, tier, variant);
            if (image && !String(item.image || '').trim()) patch.image = image;
            if (variant.id && !item.id) patch.id = variant.id;
            if (variant.hubId && !item.hubId) patch.hubId = variant.hubId;
            if (variant.sku && !item.sku) patch.sku = variant.sku;
            if (group.categoryId && !item.categoryId) patch.categoryId = group.categoryId;
            if (group.categoryName && !item.categoryName) patch.categoryName = group.categoryName;
            if (item.isPromo && item.originalPrice != null && !item.listPrice) {
                patch.listPrice = Number(item.originalPrice);
            }
            if (!Object.keys(patch).length) continue;
            cart[key] = { ...item, ...patch };
            changed = true;
        }
        if (changed) {
            saveCart(cart);
            window.dispatchEvent(new CustomEvent('ligeirinho-cart-changed'));
        }
        return changed;
    };

    const enrichCartFromCatalogAsync = async () => {
        try {
            const catalog = await loadCatalogForEnrich();
            return enrichCartFromCatalog(catalog);
        } catch {
            return false;
        }
    };

    const lastOrderSummary = () => {
        const data = loadLastOrder();
        if (!data) return null;
        const count = data.items.reduce((sum, item) => sum + item.qty, 0);
        const total = data.items.reduce((sum, item) => sum + (item.price ?? 0) * item.qty, 0);
        return { orderId: data.orderId || null, count, total, items: data.items, savedAt: data.savedAt, checkout: data.checkout || null };
    };

    const defaultPrefs = () => ({
        categories: [],
        clubOptIn: false,
    });

    const loadPrefs = () => {
        try {
            return { ...defaultPrefs(), ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
        } catch {
            return defaultPrefs();
        }
    };

    const savePrefs = (data) => {
        localStorage.setItem(PREFS_KEY, JSON.stringify({ ...loadPrefs(), ...data }));
        window.dispatchEvent(new CustomEvent('ligeirinho-prefs-changed'));
    };

    const addressHistoryId = (parts, address) => {
        const base = [parts?.street, parts?.number, parts?.city, parts?.stateCode]
            .filter(Boolean)
            .join('|')
            .toLowerCase()
            .trim();
        if (base) return base;
        const lat = Number(parts?.lat);
        const lng = Number(parts?.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) return `${lat.toFixed(5)},${lng.toFixed(5)}`;
        return String(address || '').trim().toLowerCase();
    };

    const loadSavedAddresses = () => {
        migrateLegacyAddressHistory();
        try {
            const list = JSON.parse(localStorage.getItem(savedAddressesStorageKey()) || '[]');
            return Array.isArray(list) ? list : [];
        } catch {
            return [];
        }
    };

    const loadAddressHistory = () => loadSavedAddresses();

    const saveAddressToList = (entry, opts = {}) => {
        const address = String(entry?.address || '').trim();
        const addressParts = entry?.addressParts;
        if (!address || !addressParts) return;
        const id = addressHistoryId(addressParts, address);
        if (!id) return;
        const label = String(opts.label ?? entry?.label ?? '').trim();
        const existing = loadSavedAddresses().find((item) => item.id === id);
        const history = loadSavedAddresses().filter((item) => item.id !== id);
        history.unshift({
            id,
            label: label || existing?.label || '',
            address,
            addressParts: { ...addressParts },
            savedAt: existing?.savedAt || Date.now(),
            usedAt: Date.now(),
        });
        try {
            localStorage.setItem(
                savedAddressesStorageKey(),
                JSON.stringify(history.slice(0, SAVED_ADDRESSES_MAX)),
            );
            window.dispatchEvent(new CustomEvent('ligeirinho-addresses-changed'));
        } catch {
            /* quota / private mode */
        }
    };

    const saveAddressToHistory = (entry, opts) => saveAddressToList(entry, opts);

    const removeSavedAddress = (id) => {
        if (!id) return;
        const history = loadSavedAddresses().filter((item) => item.id !== id);
        try {
            localStorage.setItem(savedAddressesStorageKey(), JSON.stringify(history));
            window.dispatchEvent(new CustomEvent('ligeirinho-addresses-changed'));
        } catch {
            /* ignore */
        }
    };

    const removeAddressFromHistory = (id) => removeSavedAddress(id);

    const findSavedAddressId = (checkout) => {
        const address = String(checkout?.address || '').trim();
        const parts = checkout?.addressParts;
        if (!address) return '';
        return addressHistoryId(parts || {}, address);
    };

    const ufFromParts = (parts = {}) => {
        const code = String(parts.stateCode || '').trim();
        if (code) return code.slice(0, 2).toUpperCase();
        const map = {
            'são paulo': 'SP',
            'sao paulo': 'SP',
            'rio de janeiro': 'RJ',
            'minas gerais': 'MG',
            paraná: 'PR',
            parana: 'PR',
            'santa catarina': 'SC',
            'rio grande do sul': 'RS',
            bahia: 'BA',
            goiás: 'GO',
            goias: 'GO',
            'distrito federal': 'DF',
        };
        return map[String(parts.state || '').trim().toLowerCase()] || '';
    };

    /** Remove ruído de geocoder (Brasil, região, CEP) de strings longas. */
    const shortenRawAddress = (raw) => {
        let s = String(raw || '').trim();
        if (!s) return '';
        s = s
            .replace(/,?\s*Brasil\s*$/i, '')
            .replace(/,?\s*Região\s+[\wÀ-ú]+(?:\s+[\wÀ-ú]+)*/gi, '')
            .replace(/,?\s*\d{5}-?\d{3}\b/g, '')
            .replace(/\s*,\s*,+/g, ',')
            .replace(/^,\s*|,\s*$/g, '')
            .replace(/\s{2,}/g, ' ')
            .trim();

        const chunks = s
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean);
        if (chunks.length < 3) return s;

        const streetIdx = chunks.findIndex((part) =>
            /^(rua|r\.|av\.?|avenida|estr\.?|estrada|alameda|travessa|rod\.?|rodovia|praça|praca|viela)\b/i.test(
                part,
            ),
        );
        if (streetIdx >= 0) {
            const street = chunks[streetIdx];
            const prev = streetIdx > 0 ? chunks[streetIdx - 1] : '';
            const number = /^\d+[A-Za-z]?$/.test(prev) ? prev : '';
            const after = chunks.slice(streetIdx + 1).filter((part) => !/^(brasil)$/i.test(part));
            const neighborhood = after[0] || '';
            const city = after[1] || '';
            let uf = after.find((part) => /^[A-Za-z]{2}$/.test(part)) || '';
            if (!uf) {
                const stateName = after[2] || '';
                uf = ufFromParts({ state: stateName });
            }
            return [number ? `${street}, ${number}` : street, neighborhood, city, uf]
                .filter(Boolean)
                .join(' - ');
        }

        return chunks.slice(0, 4).join(' - ');
    };

    /**
     * Endereço curto para listas: "Rua X, N - Bairro - Cidade - UF".
     * Aceita item salvo `{ address, addressParts }` ou só `addressParts`.
     */
    const formatShortAddress = (entry) => {
        const parts = entry?.addressParts && typeof entry.addressParts === 'object'
            ? entry.addressParts
            : entry && typeof entry === 'object' && (entry.street || entry.city)
              ? entry
              : {};
        const street = String(parts.street || '').trim();
        const number = parts.noNumber ? 'S/N' : String(parts.number || '').trim();
        const streetLine = [street, number].filter(Boolean).join(', ');
        const uf = ufFromParts(parts);
        const short = [streetLine, parts.neighborhood, parts.city, uf]
            .map((part) => String(part || '').trim())
            .filter(Boolean)
            .join(' - ');
        if (short) return short;
        return shortenRawAddress(entry?.address || '');
    };

    /** Apelido útil (Loja, Casa) — ignora display_name longo do mapa. */
    const isAddressNickname = (label, shortAddress = '') => {
        const text = String(label || '').trim();
        if (!text) return false;
        if (text.length > 40) return false;
        if (/brasil|região sudeste|região nordeste|região|,\s*.+,\s*.+,/i.test(text)) return false;
        if (shortAddress && text.toLowerCase() === shortAddress.toLowerCase()) return false;
        return true;
    };

    /** Linhas para UI de escolha: título + meta opcional. */
    const addressDisplayLines = (item) => {
        const short = formatShortAddress(item);
        const fallback = String(item?.address || '').trim();
        if (isAddressNickname(item?.label, short)) {
            return { title: String(item.label).trim(), meta: short || fallback };
        }
        return { title: short || fallback, meta: '' };
    };

    const TOTEM_CHECKOUT_DEFAULTS = {
        deliveryType: 'retirada',
        address: '',
        payment: 'pix',
        notes: '',
    };

    const clearTotemSession = () => {
        saveCart({});
        saveCheckout(TOTEM_CHECKOUT_DEFAULTS);
    };

    const updateNavCartBadge = () => {
        const badge = document.getElementById('nav-cart-badge');
        const tabBadge = document.getElementById('app-tab-cart-badge');
        const count = cartItemCount(loadCart());
        const text = count > 99 ? '99+' : String(count);
        [badge, tabBadge].forEach((el) => {
            if (!el) return;
            el.textContent = text;
            el.classList.toggle('hidden', count === 0);
        });
    };

    const repriceFromCatalog = (catalogData) => {
        if (isEditingOrder()) return false;
        const checkout = loadCheckout();
        if (String(checkout.orderTabelaPrecoId || '').trim()) return false;
        const pricing = window.LigeirinhoPricing;
        if (!pricing?.buildGroups || !pricing?.getVariant) return false;
        const cart = loadCart();
        const entries = cartEntries(cart);
        if (!entries.length || !catalogData?.categories?.length) return false;

        const groups = pricing.buildGroups(catalogData);
        let changed = false;
        for (const item of entries) {
            if (item.priceLocked || item.promoId || item.isPromo) continue;
            let group = null;
            for (const g of groups.values()) {
                for (const tier of ['unidade', 'caixa', 'pallet']) {
                    if (g.variants?.[tier]?.id === item.id) {
                        group = g;
                        break;
                    }
                }
                if (group) break;
            }
            if (!group) continue;
            const tier = item.packType || pricing.getDefaultTier?.(group) || 'caixa';
            const variant = pricing.getVariant(group, tier);
            const nextPrice = Number(variant?.price);
            if (!Number.isFinite(nextPrice) || nextPrice <= 0) continue;
            if (Math.abs(nextPrice - Number(item.price || 0)) < 0.005) continue;
            item.price = nextPrice;
            changed = true;
        }
        if (changed) {
            saveCart(cart);
            window.dispatchEvent(new CustomEvent('ligeirinho-cart-changed'));
        }
        return changed;
    };

    window.LigeirinhoCart = {
        CART_KEY,
        CHECKOUT_KEY,
        LAST_ORDER_KEY,
        PREFS_KEY,
        ADDRESS_HISTORY_KEY,
        SAVED_ADDRESSES_PREFIX,
        loadSavedAddresses,
        loadAddressHistory,
        saveAddressToList,
        saveAddressToHistory,
        removeSavedAddress,
        removeAddressFromHistory,
        findSavedAddressId,
        formatShortAddress,
        addressDisplayLines,
        isAddressNickname,
        loadCart,
        saveCart,
        loadCheckout,
        saveCheckout,
        saveLastOrder,
        loadLastOrder,
        restoreLastOrder,
        clearCheckoutPayment,
        checkoutForReorder,
        loadOrderIntoCart,
        loadOrderForEdit,
        loadOrderForReorder,
        enrichCartFromCatalog,
        enrichCartFromCatalogAsync,
        isEditingOrder,
        exitOrderEditMode,
        lastOrderSummary,
        loadPrefs,
        savePrefs,
        cartEntries,
        cartItemCount,
        cartTotalValue,
        cartSummary,
        formatMoney,
        packTypeLabel,
        packTypeFromCartKey,
        itemPackDetailText,
        itemPackPriceLabel,
        lineSubtotal,
        itemMetaText,
        updateNavCartBadge,
        repriceFromCatalog,
        clearTotemSession,
        TOTEM_CHECKOUT_DEFAULTS,
    };

    document.addEventListener('click', (e) => {
        const backCart = e.target.closest('[data-totem-back-cart]');
        if (backCart) {
            e.preventDefault();
            if (!cartItemCount(loadCart())) {
                restoreLastOrder();
            }
            const href = backCart.getAttribute('href') || 'totem.html';
            const url = new URL(href, window.location.href);
            url.searchParams.set('cart', 'open');
            window.location.replace(`${url.pathname}${url.search}`);
            return;
        }
        const el = e.target.closest('[data-totem-cancel]');
        if (!el) return;
        e.preventDefault();
        clearTotemSession();
        window.location.replace(el.getAttribute('href') || 'totem.html');
    });

    window.addEventListener('ligeirinho-cart-changed', updateNavCartBadge);
    window.addEventListener('storage', (e) => {
        if (e.key === CART_KEY) {
            cartCache = null;
            updateNavCartBadge();
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateNavCartBadge);
    } else {
        updateNavCartBadge();
    }
})();
