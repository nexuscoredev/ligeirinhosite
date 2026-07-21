(function () {
    const CART_KEY = 'ligeirinho-cart-v1';
    const CHECKOUT_KEY = 'ligeirinho-checkout-v1';
    const LAST_ORDER_KEY = 'ligeirinho-last-order-v1';
    const PREFS_KEY = 'ligeirinho-prefs-v1';

    const loadCart = () => {
        try {
            return JSON.parse(localStorage.getItem(CART_KEY) || '{}');
        } catch {
            return {};
        }
    };

    const saveCart = (cart) => {
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
        window.dispatchEvent(new CustomEvent('ligeirinho-cart-changed'));
    };

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

    window.LigeirinhoCart = {
        CART_KEY,
        CHECKOUT_KEY,
        LAST_ORDER_KEY,
        PREFS_KEY,
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
        if (e.key === CART_KEY) updateNavCartBadge();
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateNavCartBadge);
    } else {
        updateNavCartBadge();
    }
})();
