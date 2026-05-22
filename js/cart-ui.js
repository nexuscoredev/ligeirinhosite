(function () {
    const WHATSAPP_PHONE = '5511970924909';
    const LG_QUERY = '(min-width: 1024px)';

    const cartShellHtml = `
<div id="cart-panel" class="fixed bottom-8 right-8 z-[70] hidden w-80 max-w-[calc(100vw-2rem)] flex-col" role="dialog" aria-modal="true" aria-labelledby="cart-panel-title">
<div class="glass-panel rounded-xl shadow-2xl p-5 flex flex-col max-h-[calc(100vh-6rem)] border border-surface-variant/30">
<div class="flex justify-between items-center mb-4 border-b border-surface-variant/30 pb-3 shrink-0">
<h3 id="cart-panel-title" class="font-headline-md text-headline-md text-on-surface text-lg flex items-center gap-2">
<span class="material-symbols-outlined text-vibrant-orange">shopping_bag</span>
                    Seu pedido
                </h3>
<span id="cart-count-badge" class="bg-vibrant-orange text-deep-black font-bold px-2 py-1 rounded-md text-xs">0 itens</span>
</div>
<div id="cart-items" class="space-y-3 mb-4 overflow-y-auto pr-1 flex-1 min-h-0"></div>
<div class="border-t border-surface-variant/30 pt-4 shrink-0">
<div class="flex justify-between items-center mb-4">
<span class="font-headline-md text-base text-on-surface">Total</span>
<span id="cart-total" class="font-label-caps text-lg text-vibrant-orange">R$ 0,00</span>
</div>
<a id="cart-whatsapp-btn" class="w-full bg-vibrant-orange hover:bg-primary-container text-deep-black font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(255,107,0,0.3)] pointer-events-none opacity-50" href="#" target="_blank" rel="noopener noreferrer" aria-disabled="true">
                Enviar pedido no WhatsApp
                <span class="material-symbols-outlined text-sm">arrow_forward</span>
</a>
</div>
</div>
</div>
<div id="cart-mobile-sheet" class="fixed inset-0 z-[70] hidden" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="cart-sheet-title">
<div class="absolute inset-0 bg-deep-black/70" data-cart-close></div>
<div class="absolute bottom-0 left-0 right-0 glass-panel rounded-t-2xl p-5 max-h-[85vh] flex flex-col border-t border-surface-variant/30">
<div class="flex justify-between items-center mb-4 shrink-0">
<h3 id="cart-sheet-title" class="font-headline-md text-on-surface">Seu pedido</h3>
<button type="button" class="p-2 text-on-surface-variant hover:text-on-surface" data-cart-close aria-label="Fechar carrinho">
<span class="material-symbols-outlined">close</span>
</button>
</div>
<div id="cart-items-mobile" class="overflow-y-auto flex-1 min-h-0 mb-4 space-y-3"></div>
<div class="border-t border-surface-variant/30 pt-4 shrink-0">
<div class="flex justify-between mb-4">
<span class="font-headline-md text-on-surface">Total</span>
<span id="cart-total-mobile" class="font-label-caps text-lg text-vibrant-orange">R$ 0,00</span>
</div>
<a id="cart-whatsapp-btn-mobile" class="w-full bg-vibrant-orange hover:bg-primary-container text-deep-black font-bold py-3 rounded-lg flex items-center justify-center gap-2 pointer-events-none opacity-50" href="#" target="_blank" rel="noopener noreferrer" aria-disabled="true">Enviar pedido no WhatsApp</a>
</div>
</div>
</div>`;

    let panel;
    let sheet;
    let cartApi;
    let scrollLockY = 0;

    const lockBodyScroll = () => {
        scrollLockY = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollLockY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.overflow = 'hidden';
    };

    const unlockBodyScroll = () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollLockY);
    };

    const formatPrice = (value) => {
        if (value == null || Number.isNaN(value)) return '—';
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const escapeHtml = (str) =>
        String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

    const buildWhatsAppMessage = (cart) => {
        const items = cartApi.cartEntries(cart);
        if (!items.length) return '';

        const lines = ['Olá! Gostaria de fazer um pedido:', ''];
        items.forEach((item) => {
            const unit = formatPrice(item.price);
            const subtotal = formatPrice((item.price ?? 0) * item.qty);
            lines.push(`${item.qty}x ${item.name} — ${unit} (subtotal ${subtotal})`);
        });
        lines.push('');
        lines.push(`Total: ${formatPrice(cartApi.cartTotalValue(cart))}`);
        return lines.join('\n');
    };

    const buildWhatsAppUrl = (cart) => {
        const text = buildWhatsAppMessage(cart);
        if (!text) return '#';
        return `https://api.whatsapp.com/send/?phone=${WHATSAPP_PHONE}&text=${encodeURIComponent(text)}&type=phone_number&app_absent=0`;
    };

    const cartLineHtml = (item) => {
        const subtotal = formatPrice((item.price ?? 0) * item.qty);
        return `<div class="flex justify-between items-start gap-2" data-cart-line="${item.id}">
<div class="flex-1 min-w-0">
<p class="font-body-md text-sm text-on-surface line-clamp-2">${escapeHtml(item.name)}</p>
<p class="font-label-caps text-xs text-gold-accent mt-1">${item.qty}x · ${subtotal}</p>
</div>
<div class="flex items-center gap-1 shrink-0">
<button type="button" class="cart-qty-minus w-7 h-7 rounded bg-surface-variant/40 text-on-surface hover:bg-surface-variant" data-id="${item.id}" aria-label="Diminuir">−</button>
<span class="font-label-caps text-xs w-5 text-center">${item.qty}</span>
<button type="button" class="cart-qty-plus w-7 h-7 rounded bg-surface-variant/40 text-on-surface hover:bg-surface-variant" data-id="${item.id}" aria-label="Aumentar">+</button>
<button type="button" class="cart-remove p-1 text-surface-variant hover:text-error" data-id="${item.id}" aria-label="Remover">
<span class="material-symbols-outlined text-sm">close</span>
</button>
</div>
</div>`;
    };

    const setWhatsAppButtons = (cart) => {
        const hasItems = cartApi.cartItemCount(cart) > 0;
        const url = buildWhatsAppUrl(cart);
        [document.getElementById('cart-whatsapp-btn'), document.getElementById('cart-whatsapp-btn-mobile')].forEach(
            (btn) => {
                if (!btn) return;
                btn.href = hasItems ? url : '#';
                btn.classList.toggle('pointer-events-none', !hasItems);
                btn.classList.toggle('opacity-50', !hasItems);
                btn.setAttribute('aria-disabled', hasItems ? 'false' : 'true');
            }
        );
    };

    const render = () => {
        if (!cartApi) return;
        const cart = cartApi.loadCart();
        const items = cartApi.cartEntries(cart);
        const count = cartApi.cartItemCount(cart);
        const total = formatPrice(cartApi.cartTotalValue(cart));
        const emptyHtml = `<p class="font-body-md text-sm text-on-surface-variant">Seu carrinho está vazio. <a class="text-vibrant-orange hover:underline" href="pedidos.html">Ver catálogo</a> para adicionar produtos.</p>`;
        const listHtml = items.length ? items.map(cartLineHtml).join('') : emptyHtml;

        const cartItemsEl = document.getElementById('cart-items');
        const cartItemsMobileEl = document.getElementById('cart-items-mobile');
        const cartTotalEl = document.getElementById('cart-total');
        const cartTotalMobileEl = document.getElementById('cart-total-mobile');
        const cartCountBadge = document.getElementById('cart-count-badge');

        if (cartItemsEl) cartItemsEl.innerHTML = listHtml;
        if (cartItemsMobileEl) cartItemsMobileEl.innerHTML = listHtml;
        if (cartTotalEl) cartTotalEl.textContent = total;
        if (cartTotalMobileEl) cartTotalMobileEl.textContent = total;
        if (cartCountBadge) {
            cartCountBadge.textContent = count === 1 ? '1 item' : `${count} itens`;
        }
        setWhatsAppButtons(cart);
        cartApi.updateNavCartBadge();
    };

    const changeQty = (id, delta) => {
        const cart = cartApi.loadCart();
        if (!cart[id]) return;
        cart[id].qty += delta;
        if (cart[id].qty <= 0) delete cart[id];
        cartApi.saveCart(cart);
        render();
    };

    const removeFromCart = (id) => {
        const cart = cartApi.loadCart();
        delete cart[id];
        cartApi.saveCart(cart);
        render();
    };

    const isCartOpen = () => {
        const panelOpen = panel && !panel.classList.contains('hidden');
        const sheetOpen = sheet && !sheet.classList.contains('hidden');
        return panelOpen || sheetOpen;
    };

    const close = (options = {}) => {
        const { restoreScroll = true } = options;
        if (!isCartOpen()) return;

        panel?.classList.add('hidden');
        panel?.classList.remove('flex');
        sheet?.classList.add('hidden');
        sheet?.setAttribute('aria-hidden', 'true');

        if (!restoreScroll) return;

        if (document.body.style.position === 'fixed') {
            unlockBodyScroll();
        } else {
            document.body.style.overflow = '';
        }
    };

    const open = () => {
        if (!panel || !sheet) return;
        window.LigeirinhoNav?.closeMobileMenu?.();
        render();
        if (window.matchMedia(LG_QUERY).matches) {
            sheet.classList.add('hidden');
            sheet.setAttribute('aria-hidden', 'true');
            panel.classList.remove('hidden');
            panel.classList.add('flex');
        } else {
            panel.classList.add('hidden');
            panel.classList.remove('flex');
            sheet.classList.remove('hidden');
            sheet.setAttribute('aria-hidden', 'false');
            lockBodyScroll();
        }
    };

    const handleCartAction = (e) => {
        const minus = e.target.closest('.cart-qty-minus');
        const plus = e.target.closest('.cart-qty-plus');
        const remove = e.target.closest('.cart-remove');
        if (minus) changeQty(minus.dataset.id, -1);
        if (plus) changeQty(plus.dataset.id, 1);
        if (remove) removeFromCart(remove.dataset.id);
    };

    const bindEvents = () => {
        panel = document.getElementById('cart-panel');
        sheet = document.getElementById('cart-mobile-sheet');

        document.getElementById('cart-items')?.addEventListener('click', handleCartAction);
        document.getElementById('cart-items-mobile')?.addEventListener('click', handleCartAction);

        sheet?.querySelectorAll('[data-cart-close]').forEach((el) => {
            el.addEventListener('click', close);
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') close();
        });

        window.addEventListener('ligeirinho-cart-changed', render);
    };

    let navBound = false;

    const bindNavToggle = () => {
        const toggle = document.getElementById('nav-cart-toggle');
        if (!toggle || navBound) return;
        navBound = true;
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            const panelOpen = panel && !panel.classList.contains('hidden');
            const sheetOpen = sheet && !sheet.classList.contains('hidden');
            if (panelOpen || sheetOpen) close();
            else open();
        });
    };

    const init = () => {
        cartApi = window.LigeirinhoCart;
        if (!cartApi) return;

        if (!document.getElementById('cart-panel')) {
            const root = document.createElement('div');
            root.id = 'site-cart-root';
            root.innerHTML = cartShellHtml;
            document.body.appendChild(root);
        }

        bindEvents();
        render();
    };

    window.LigeirinhoCartUI = { init, open, close, render, bindNavToggle, isOpen: isCartOpen };
})();
