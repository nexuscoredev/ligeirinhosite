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
                    checkout: checkout || loadCheckout(),
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
        if (data.checkout) saveCheckout(data.checkout);
        return true;
    };

    const loadOrderIntoCart = (order) => {
        const items = Array.isArray(order?.items) ? order.items : [];
        if (!items.length) return false;
        const cart = {};
        items.forEach((item) => {
            const key = item.cartKey || item.id;
            if (!key) return;
            cart[key] = {
                id: item.id || key,
                cartKey: key,
                name: item.name,
                price: item.price,
                qty: Math.max(1, Number(item.qty) || 1),
                packType: item.packType || 'caixa',
                image: item.image || '',
                categoryId: item.categoryId || '',
                categoryName: item.categoryName || '',
                hubId: item.hubId || '',
                sku: item.sku || '',
                ...promoFieldsFromItem(item),
            };
        });
        saveCart(cart);
        saveLastOrder(cart, loadCheckout(), order?.id || null);
        return true;
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
        const pricing = window.LigeirinhoPricing;
        if (!pricing?.buildGroups || !pricing?.getVariant) return false;
        const cart = loadCart();
        const entries = cartEntries(cart);
        if (!entries.length || !catalogData?.categories?.length) return false;

        const groups = pricing.buildGroups(catalogData);
        let changed = false;
        for (const item of entries) {
            if (item.promoId || item.isPromo) continue;
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
        loadOrderIntoCart,
        lastOrderSummary,
        loadPrefs,
        savePrefs,
        cartEntries,
        cartItemCount,
        cartTotalValue,
        cartSummary,
        formatMoney,
        packTypeLabel,
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
