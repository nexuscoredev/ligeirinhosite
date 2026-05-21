(function () {
    const CART_KEY = 'ligeirinho-cart-v1';

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

    const cartEntries = (cart) => Object.values(cart).filter((item) => item.qty > 0);

    const cartItemCount = (cart) => cartEntries(cart).reduce((sum, item) => sum + item.qty, 0);

    const cartTotalValue = (cart) =>
        cartEntries(cart).reduce((sum, item) => sum + (item.price ?? 0) * item.qty, 0);

    const updateNavCartBadge = () => {
        const badge = document.getElementById('nav-cart-badge');
        if (!badge) return;
        const count = cartItemCount(loadCart());
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.classList.toggle('hidden', count === 0);
    };

    window.LigeirinhoCart = {
        CART_KEY,
        loadCart,
        saveCart,
        cartEntries,
        cartItemCount,
        cartTotalValue,
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
