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
        payment: 'mercado_pago',
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
        return t === 'pallet' ? 'Pallet' : 'Caixa';
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

    const saveLastOrder = (cart, checkout) => {
        const items = cartEntries(cart);
        if (!items.length) return;
        try {
            localStorage.setItem(
                LAST_ORDER_KEY,
                JSON.stringify({
                    items: items.map((item) => ({
                        id: item.id,
                        cartKey: item.cartKey || item.id,
                        name: item.name,
                        price: item.price,
                        qty: item.qty,
                        packType: item.packType,
                        image: item.image || '',
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

    const lastOrderSummary = () => {
        const data = loadLastOrder();
        if (!data) return null;
        const count = data.items.reduce((sum, item) => sum + item.qty, 0);
        const total = data.items.reduce((sum, item) => sum + (item.price ?? 0) * item.qty, 0);
        return { count, total, items: data.items, savedAt: data.savedAt };
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
    };

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
