(function () {
    const WHATSAPP_PHONE = '5511970924909';
    const LG_QUERY = '(min-width: 1024px)';

    const cartShellHtml = `
<div id="cart-panel" class="fixed bottom-8 right-8 z-[70] hidden w-96 max-w-[calc(100vw-2rem)] flex-col" role="dialog" aria-modal="true" aria-labelledby="cart-panel-title">
<div class="lig-cart-panel rounded-xl p-5 flex flex-col max-h-[calc(100vh-6rem)]">
<div class="flex justify-between items-center mb-4 lig-cart-divider border-b pb-3 shrink-0">
<h3 id="cart-panel-title" class="font-headline-md text-lg flex items-center gap-2 lig-cart-text">
<span class="material-symbols-outlined text-vibrant-yellow">shopping_bag</span>
                    Seu pedido
                </h3>
<span id="cart-count-badge" class="bg-vibrant-yellow text-deep-black font-bold px-2 py-1 rounded-md text-xs">0 itens</span>
</div>
<div id="cart-items" class="space-y-3 mb-4 overflow-y-auto pr-1 flex-1 min-h-0"></div>
<div class="cart-checkout space-y-3 mb-4 lig-cart-divider border-t pt-4 shrink-0">
<p class="text-xs lig-cart-label font-semibold uppercase tracking-wide">Detalhes do pedido</p>
<div class="grid grid-cols-2 gap-2">
<label class="lig-cart-checkout-label flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold cursor-pointer has-[:checked]:border-vibrant-yellow has-[:checked]:bg-yellow-50 has-[:checked]:text-vibrant-yellow">
<input type="radio" name="cart-delivery-panel" value="entrega" class="sr-only" data-checkout="deliveryType"> Entrega
</label>
<label class="lig-cart-checkout-label flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold cursor-pointer has-[:checked]:border-vibrant-yellow has-[:checked]:bg-yellow-50 has-[:checked]:text-vibrant-yellow">
<input type="radio" name="cart-delivery-panel" value="retirada" class="sr-only" data-checkout="deliveryType"> Retirada
</label>
</div>
<input type="text" data-checkout="address" placeholder="Endereço completo (rua, nº, bairro)" class="lig-cart-input w-full rounded-lg px-3 py-2.5 text-sm min-h-[44px]" autocomplete="street-address">
<select data-checkout="payment" class="lig-cart-input w-full rounded-lg px-3 py-2.5 text-sm min-h-[44px]">
<option value="pix">Pagamento: Pix</option>
<option value="dinheiro">Pagamento: Dinheiro</option>
<option value="cartao">Pagamento: Cartão na entrega</option>
</select>
<textarea data-checkout="notes" placeholder="Observações (opcional)" rows="2" class="lig-cart-input w-full rounded-lg px-3 py-2.5 text-sm resize-none"></textarea>
</div>
<div class="lig-cart-divider border-t pt-4 shrink-0">
<div class="flex justify-between items-center mb-4">
<span class="font-headline-md text-base lig-cart-text">Total</span>
<span id="cart-total" class="text-lg font-bold text-vibrant-yellow">R$ 0,00</span>
</div>
<button type="button" id="cart-pay-btn" class="w-full bg-vibrant-yellow hover:bg-[#D9BB35] text-deep-black font-bold py-3 rounded-full transition-colors flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(247,213,60,0.35)] pointer-events-none opacity-50 mb-2" disabled aria-disabled="true">
                Pagar no app
                <span class="material-symbols-outlined text-sm">payments</span>
</button>
<a id="cart-whatsapp-btn" class="w-full border border-[#25D366]/40 text-[#128C7E] font-semibold py-2.5 rounded-full transition-colors flex items-center justify-center gap-2 text-sm pointer-events-none opacity-50" href="#" target="_blank" rel="noopener noreferrer" aria-disabled="true">
                Pedir pelo WhatsApp
</a>
</div>
</div>
</div>
<div id="cart-mobile-sheet" class="fixed inset-0 z-[70] hidden" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="cart-sheet-title">
<div class="absolute inset-0 lig-cart-overlay" data-cart-close></div>
<div class="absolute bottom-0 left-0 right-0 lig-cart-sheet rounded-t-2xl p-5 max-h-[85vh] flex flex-col">
<div class="flex justify-between items-center mb-4 shrink-0">
<h3 id="cart-sheet-title" class="font-headline-md lig-cart-text">Seu pedido</h3>
<button type="button" class="p-2 lig-cart-text-muted hover:lig-cart-text" data-cart-close aria-label="Fechar carrinho">
<span class="material-symbols-outlined">close</span>
</button>
</div>
<div id="cart-items-mobile" class="overflow-y-auto flex-1 min-h-0 mb-4 space-y-3"></div>
<div class="cart-checkout space-y-3 mb-4 lig-cart-divider border-t pt-4 shrink-0">
<p class="text-xs lig-cart-label font-semibold uppercase tracking-wide">Detalhes do pedido</p>
<div class="grid grid-cols-2 gap-2">
<label class="lig-cart-checkout-label flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold cursor-pointer has-[:checked]:border-vibrant-yellow has-[:checked]:bg-yellow-50 has-[:checked]:text-vibrant-yellow">
<input type="radio" name="cart-delivery-mobile" value="entrega" class="sr-only" data-checkout="deliveryType"> Entrega
</label>
<label class="lig-cart-checkout-label flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold cursor-pointer has-[:checked]:border-vibrant-yellow has-[:checked]:bg-yellow-50 has-[:checked]:text-vibrant-yellow">
<input type="radio" name="cart-delivery-mobile" value="retirada" class="sr-only" data-checkout="deliveryType"> Retirada
</label>
</div>
<input type="text" data-checkout="address" placeholder="Endereço completo (rua, nº, bairro)" class="lig-cart-input w-full rounded-lg px-3 py-2.5 text-sm min-h-[44px]" autocomplete="street-address">
<select data-checkout="payment" class="lig-cart-input w-full rounded-lg px-3 py-2.5 text-sm min-h-[44px]">
<option value="pix">Pagamento: Pix</option>
<option value="dinheiro">Pagamento: Dinheiro</option>
<option value="cartao">Pagamento: Cartão na entrega</option>
</select>
<textarea data-checkout="notes" placeholder="Observações (opcional)" rows="2" class="lig-cart-input w-full rounded-lg px-3 py-2.5 text-sm resize-none"></textarea>
</div>
<div class="lig-cart-divider border-t pt-4 shrink-0">
<div class="flex justify-between mb-4">
<span class="font-headline-md lig-cart-text">Total</span>
<span id="cart-total-mobile" class="text-lg font-bold text-vibrant-yellow">R$ 0,00</span>
</div>
<button type="button" id="cart-pay-btn-mobile" class="w-full bg-vibrant-yellow hover:bg-[#D9BB35] text-deep-black font-bold py-3 rounded-full flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(247,213,60,0.35)] pointer-events-none opacity-50 mb-2" disabled>Pagar no app</button>
<a id="cart-whatsapp-btn-mobile" class="w-full border border-[#25D366]/40 text-[#128C7E] font-semibold py-2.5 rounded-full flex items-center justify-center gap-2 text-sm pointer-events-none opacity-50" href="#" target="_blank" rel="noopener noreferrer" aria-disabled="true">Pedir pelo WhatsApp</a>
</div>
</div>
</div>`;

    let panel;
    let sheet;
    let cartApi;
    let scrollLockY = 0;
    let toastHideTimer = null;

    const toastStyles = `
        @keyframes cart-nav-bump {
            0%, 100% { transform: scale(1); }
            40% { transform: scale(1.18); }
        }
        .cart-nav-bump {
            animation: cart-nav-bump 0.45s ease;
        }
        #cart-add-toast {
            opacity: 0;
            transform: translateY(12px);
            transition: opacity 0.22s ease, transform 0.22s ease;
            pointer-events: none;
        }
        #cart-add-toast.cart-add-toast--visible {
            opacity: 1;
            transform: translateY(0);
            pointer-events: auto;
        }
        @media (prefers-reduced-motion: reduce) {
            #cart-add-toast { transition: none; }
            .cart-nav-bump { animation: none; }
        }
    `;

    const ensureFeedbackUi = () => {
        if (!document.getElementById('ligeirinho-cart-feedback-style')) {
            const style = document.createElement('style');
            style.id = 'ligeirinho-cart-feedback-style';
            style.textContent = toastStyles;
            document.head.appendChild(style);
        }

        if (!document.getElementById('cart-add-toast')) {
            const toast = document.createElement('div');
            toast.id = 'cart-add-toast';
            toast.className =
                'fixed z-[80] bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-4 right-4 md:bottom-8 md:left-auto md:right-8 md:max-w-sm hidden';
            toast.setAttribute('role', 'status');
            toast.setAttribute('aria-live', 'polite');
            toast.setAttribute('aria-atomic', 'true');
            toast.innerHTML = `<div class="lig-toast-inner flex items-center gap-3 rounded-xl px-4 py-3">
<span class="material-symbols-outlined text-vibrant-yellow text-[26px] shrink-0" aria-hidden="true">check_circle</span>
<div class="min-w-0 flex-1">
<p class="text-sm font-semibold lig-cart-text leading-tight">Adicionado ao carrinho</p>
<p id="cart-add-toast-name" class="text-xs lig-cart-text-muted truncate mt-0.5"></p>
</div>
<button type="button" id="cart-add-toast-open" class="shrink-0 text-xs font-bold text-vibrant-yellow hover:text-[#D9BB35] px-2 py-1 rounded-md min-h-[36px]">Ver</button>
</div>`;
            document.body.appendChild(toast);

            toast.querySelector('#cart-add-toast-open')?.addEventListener('click', () => {
                hideAddToast();
                open();
            });
        }

        if (!document.getElementById('cart-live-region')) {
            const live = document.createElement('div');
            live.id = 'cart-live-region';
            live.setAttribute('aria-live', 'polite');
            live.setAttribute('aria-atomic', 'true');
            live.className =
                'absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0';
            document.body.appendChild(live);
        }
    };

    const shortProductName = (name) => {
        const text = String(name || '').trim();
        if (text.length <= 42) return text;
        return `${text.slice(0, 39)}…`;
    };

    const hideAddToast = () => {
        const toast = document.getElementById('cart-add-toast');
        if (!toast) return;
        toast.classList.remove('cart-add-toast--visible');
        window.clearTimeout(toastHideTimer);
        toastHideTimer = window.setTimeout(() => {
            toast.classList.add('hidden');
        }, 220);
    };

    const burstConfetti = (x, y, count = 14) => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const colors = ['#F7D53C', '#F9E08A', '#F0C838', '#E8BE30'];
        const originX = x ?? window.innerWidth / 2;
        const originY = y ?? window.innerHeight * 0.65;
        for (let i = 0; i < count; i += 1) {
            const el = document.createElement('span');
            el.className = 'lig-confetti';
            const angle = (Math.PI * 2 * i) / count;
            const dist = 40 + Math.random() * 50;
            el.style.left = `${originX}px`;
            el.style.top = `${originY}px`;
            el.style.background = colors[i % colors.length];
            el.style.setProperty('--lig-dx', `${Math.cos(angle) * dist}px`);
            el.style.setProperty('--lig-dy', `${Math.sin(angle) * dist - 30}px`);
            document.body.appendChild(el);
            window.setTimeout(() => el.remove(), 800);
        }
    };

    const showAddedFeedback = (productName) => {
        ensureFeedbackUi();

        const toast = document.getElementById('cart-add-toast');
        const nameEl = document.getElementById('cart-add-toast-name');
        const live = document.getElementById('cart-live-region');
        const label = shortProductName(productName);

        if (nameEl) nameEl.textContent = label;
        if (live) live.textContent = `${label} adicionado ao carrinho.`;

        if (toast) {
            toast.classList.remove('hidden');
            window.requestAnimationFrame(() => {
                toast.classList.add('cart-add-toast--visible');
            });
            window.clearTimeout(toastHideTimer);
            toastHideTimer = window.setTimeout(hideAddToast, 2800);
        }

        const navToggle = document.getElementById('nav-cart-toggle');
        navToggle?.classList.remove('cart-nav-bump');
        void navToggle?.offsetWidth;
        navToggle?.classList.add('cart-nav-bump');
        window.setTimeout(() => navToggle?.classList.remove('cart-nav-bump'), 500);

        const tabCart = document.getElementById('app-tab-cart');
        tabCart?.classList.remove('cart-nav-bump');
        void tabCart?.offsetWidth;
        tabCart?.classList.add('cart-nav-bump');
        window.setTimeout(() => tabCart?.classList.remove('cart-nav-bump'), 500);

        burstConfetti(window.innerWidth / 2, window.innerHeight * 0.7, 6);
    };

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

        const checkout = cartApi.loadCheckout();
        const paymentLabels = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão na entrega' };

        const lines = ['Olá! Gostaria de fazer um pedido pelo Ligeirinho Parceiros:', ''];
        items.forEach((item) => {
            const unit = formatPrice(item.price);
            const subtotal = formatPrice((item.price ?? 0) * item.qty);
            lines.push(`${item.qty}x ${item.name} — ${unit} (subtotal ${subtotal})`);
        });
        lines.push('');
        lines.push(`Total: ${formatPrice(cartApi.cartTotalValue(cart))}`);
        lines.push('');
        lines.push(`Tipo: ${checkout.deliveryType === 'retirada' ? 'Retirada na loja' : 'Entrega'}`);
        if (checkout.deliveryType === 'entrega' && checkout.address?.trim()) {
            lines.push(`Endereço: ${checkout.address.trim()}`);
        }
        lines.push(`Pagamento: ${paymentLabels[checkout.payment] || checkout.payment}`);
        if (checkout.notes?.trim()) {
            lines.push(`Observações: ${checkout.notes.trim()}`);
        }
        return lines.join('\n');
    };

    const buildWhatsAppUrl = (cart) => {
        const text = buildWhatsAppMessage(cart);
        if (!text) return '#';
        return `https://api.whatsapp.com/send/?phone=${WHATSAPP_PHONE}&text=${encodeURIComponent(text)}&type=phone_number&app_absent=0`;
    };

    const cartLineHtml = (item) => {
        const lineKey = item.cartKey || item.id;
        const subtotal = formatPrice((item.price ?? 0) * item.qty);
        return `<div class="flex justify-between items-start gap-2" data-cart-line="${escapeHtml(lineKey)}">
<div class="flex-1 min-w-0">
<p class="text-sm lig-cart-text line-clamp-2">${escapeHtml(item.name)}</p>
<p class="text-xs lig-cart-text-muted mt-1">${item.qty}x · ${subtotal}</p>
</div>
<div class="flex items-center gap-1 shrink-0">
<button type="button" class="cart-qty-minus w-7 h-7 rounded-full bg-[#f5f5f5] border border-[#ebebeb] lig-cart-text hover:bg-yellow-50" data-id="${escapeHtml(lineKey)}" aria-label="Diminuir">−</button>
<span class="text-xs w-5 text-center font-semibold text-vibrant-yellow">${item.qty}</span>
<button type="button" class="cart-qty-plus w-7 h-7 rounded-full bg-vibrant-yellow text-deep-black hover:bg-[#D9BB35]" data-id="${escapeHtml(lineKey)}" aria-label="Aumentar">+</button>
<button type="button" class="cart-remove p-1 lig-cart-text-muted hover:text-red-500" data-id="${escapeHtml(lineKey)}" aria-label="Remover">
<span class="material-symbols-outlined text-sm">close</span>
</button>
</div>
</div>`;
    };

    const updateFloatCart = (cart) => {
        let floatEl = document.getElementById('ze-float-cart');
        if (!floatEl) {
            floatEl = document.createElement('div');
            floatEl.id = 'ze-float-cart';
            floatEl.innerHTML = `<button type="button" class="ze-float-cart__btn" id="ze-float-cart-btn">
<span class="ze-float-cart__left">
<span class="ze-float-cart__badge" id="ze-float-count">0</span>
<span id="ze-float-label">Ver carrinho</span>
</span>
<span id="ze-float-total">R$ 0,00</span>
</button>`;
            document.body.appendChild(floatEl);
            floatEl.querySelector('#ze-float-cart-btn')?.addEventListener('click', open);
        }

        const count = cartApi.cartItemCount(cart);
        const total = formatPrice(cartApi.cartTotalValue(cart));
        const countEl = document.getElementById('ze-float-count');
        const totalEl = document.getElementById('ze-float-total');
        const labelEl = document.getElementById('ze-float-label');

        if (countEl) countEl.textContent = count > 99 ? '99+' : String(count);
        if (totalEl) totalEl.textContent = total;
        if (labelEl) labelEl.textContent = count === 1 ? 'Ver carrinho · 1 item' : `Ver carrinho · ${count} itens`;

        const visible = count > 0 && !isCartOpen();
        floatEl.classList.toggle('ze-float-cart--visible', visible);
        document.documentElement.classList.toggle('lig-has-float-cart', count > 0);
    };

    const setCheckoutButtons = (cart) => {
        const hasItems = cartApi.cartItemCount(cart) > 0;
        const checkout = cartApi.loadCheckout();
        const needsAddress = checkout.deliveryType === 'entrega';
        const addressOk = !needsAddress || Boolean(checkout.address?.trim());
        const canCheckout = hasItems && addressOk;
        const url = buildWhatsAppUrl(cart);

        ['cart-whatsapp-btn', 'cart-whatsapp-btn-mobile'].forEach((id) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.href = canCheckout ? url : '#';
            btn.classList.toggle('pointer-events-none', !canCheckout);
            btn.classList.toggle('opacity-50', !canCheckout);
            btn.setAttribute('aria-disabled', canCheckout ? 'false' : 'true');
            btn.title = needsAddress && !addressOk ? 'Informe o endereço para entrega' : '';
        });

        ['cart-pay-btn', 'cart-pay-btn-mobile'].forEach((id) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.disabled = !canCheckout;
            btn.classList.toggle('pointer-events-none', !canCheckout);
            btn.classList.toggle('opacity-50', !canCheckout);
            btn.setAttribute('aria-disabled', canCheckout ? 'false' : 'true');
            btn.title = needsAddress && !addressOk ? 'Informe o endereço para entrega' : '';
        });
    };

    const setWhatsAppButtons = setCheckoutButtons;

    const renderCheckoutFields = () => {
        const checkout = cartApi.loadCheckout();
        document.querySelectorAll('.cart-checkout').forEach((section) => {
            section.querySelectorAll('[data-checkout="deliveryType"]').forEach((input) => {
                input.checked = input.value === checkout.deliveryType;
            });
            const addressEl = section.querySelector('[data-checkout="address"]');
            const paymentEl = section.querySelector('[data-checkout="payment"]');
            const notesEl = section.querySelector('[data-checkout="notes"]');
            if (addressEl) {
                addressEl.value = checkout.address || '';
                addressEl.closest('.cart-checkout')?.classList.toggle('cart-checkout--retirada', checkout.deliveryType === 'retirada');
                addressEl.classList.toggle('hidden', checkout.deliveryType === 'retirada');
            }
            if (paymentEl) paymentEl.value = checkout.payment || 'pix';
            if (notesEl) notesEl.value = checkout.notes || '';
        });
    };

    const bindCheckoutFields = () => {
        document.querySelectorAll('[data-checkout]').forEach((field) => {
            field.addEventListener('change', () => {
                const section = field.closest('.cart-checkout');
                const deliveryInput = section?.querySelector('[data-checkout="deliveryType"]:checked');
                cartApi.saveCheckout({
                    deliveryType: deliveryInput?.value || 'entrega',
                    address: section?.querySelector('[data-checkout="address"]')?.value || '',
                    payment: section?.querySelector('[data-checkout="payment"]')?.value || 'pix',
                    notes: section?.querySelector('[data-checkout="notes"]')?.value || '',
                });
                renderCheckoutFields();
                setWhatsAppButtons(cartApi.loadCart());
            });
            if (field.tagName === 'TEXTAREA' || field.tagName === 'INPUT') {
                field.addEventListener('input', () => {
                    const section = field.closest('.cart-checkout');
                    const deliveryInput = section?.querySelector('[data-checkout="deliveryType"]:checked');
                    cartApi.saveCheckout({
                        deliveryType: deliveryInput?.value || 'entrega',
                        address: section?.querySelector('[data-checkout="address"]')?.value || '',
                        payment: section?.querySelector('[data-checkout="payment"]')?.value || 'pix',
                        notes: section?.querySelector('[data-checkout="notes"]')?.value || '',
                    });
                    setWhatsAppButtons(cartApi.loadCart());
                });
            }
        });
    };

    const render = () => {
        if (!cartApi) return;
        const cart = cartApi.loadCart();
        const items = cartApi.cartEntries(cart);
        const count = cartApi.cartItemCount(cart);
        const total = formatPrice(cartApi.cartTotalValue(cart));
        const emptyHtml = cartApi.lastOrderSummary()
            ? `<p class="text-sm lig-cart-text-muted">Seu carrinho está vazio.</p>
<button type="button" id="cart-reorder-btn" class="mt-3 w-full rounded-full border border-vibrant-yellow/40 bg-yellow-50 text-vibrant-yellow text-sm font-bold py-2.5 min-h-[44px] hover:bg-vibrant-yellow hover:text-deep-black transition-colors">Repetir último pedido</button>
<p class="text-xs lig-cart-text-muted mt-3"><a class="text-vibrant-yellow hover:underline font-semibold" href="pedidos.html">Ver catálogo</a></p>`
            : `<p class="text-sm lig-cart-text-muted">Seu carrinho está vazio. <a class="text-vibrant-yellow hover:underline font-semibold" href="pedidos.html">Ver catálogo</a></p>`;
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
        renderCheckoutFields();
        updateFloatCart(cart);
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
        updateFloatCart(cartApi.loadCart());
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
        updateFloatCart(cartApi.loadCart());
    };

    const startAppPayment = async () => {
        const cart = cartApi.loadCart();
        const checkout = cartApi.loadCheckout();
        if (!cartApi.cartItemCount(cart)) return;

        const needsAddress = checkout.deliveryType === 'entrega';
        if (needsAddress && !checkout.address?.trim()) return;

        const session = window.LigeirinhoAuth?.loadSession?.();
        const items = cartApi.cartEntries(cart).map((item) => ({
            id: item.id,
            cartKey: item.cartKey || item.id,
            name: item.name,
            price: item.price,
            qty: item.qty,
            packType: item.packType,
        }));

        const payButtons = ['cart-pay-btn', 'cart-pay-btn-mobile'];
        payButtons.forEach((id) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Processando…';
            }
        });

        try {
            const res = await fetch('/api/orders/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items,
                    deliveryType: checkout.deliveryType,
                    address: checkout.address,
                    notes: checkout.notes,
                    customer: {
                        name: session?.name || '',
                        phone: session?.phone || '',
                        email: session?.email || '',
                    },
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Não foi possível iniciar o pagamento');

            cartApi.saveLastOrder(cart, checkout);
            window.location.href = `pagamento.html?order=${encodeURIComponent(data.orderId)}`;
        } catch (err) {
            window.alert(err.message || 'Erro ao iniciar pagamento. Tente pelo WhatsApp.');
            payButtons.forEach((id) => {
                const btn = document.getElementById(id);
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Pagar no app';
                }
            });
        }
    };

    const handleCartAction = (e) => {
        if (e.target.closest('#cart-reorder-btn')) {
            if (cartApi.restoreLastOrder()) render();
            return;
        }
        const minus = e.target.closest('.cart-qty-minus');
        const plus = e.target.closest('.cart-qty-plus');
        const remove = e.target.closest('.cart-remove');
        if (minus) changeQty(minus.dataset.id, -1);
        if (plus) changeQty(plus.dataset.id, 1);
        if (remove) removeFromCart(remove.dataset.id);
    };

    let eventsBound = false;

    const bindEvents = () => {
        if (eventsBound) return;
        eventsBound = true;

        panel = document.getElementById('cart-panel');
        sheet = document.getElementById('cart-mobile-sheet');

        document.getElementById('cart-items')?.addEventListener('click', handleCartAction);
        document.getElementById('cart-items-mobile')?.addEventListener('click', handleCartAction);

        ['cart-whatsapp-btn', 'cart-whatsapp-btn-mobile'].forEach((id) => {
            document.getElementById(id)?.addEventListener('click', () => {
                const cart = cartApi.loadCart();
                if (cartApi.cartItemCount(cart) > 0) {
                    cartApi.saveLastOrder(cart, cartApi.loadCheckout());
                }
            });
        });

        ['cart-pay-btn', 'cart-pay-btn-mobile'].forEach((id) => {
            document.getElementById(id)?.addEventListener('click', startAppPayment);
        });

        sheet?.querySelectorAll('[data-cart-close]').forEach((el) => {
            el.addEventListener('click', close);
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') close();
        });

        window.addEventListener('ligeirinho-cart-changed', render);
        window.addEventListener('ligeirinho-checkout-changed', () => {
            renderCheckoutFields();
            setWhatsAppButtons(cartApi.loadCart());
        });
        window.addEventListener('pageshow', () => {
            if (document.body.style.position === 'fixed' && !isCartOpen()) {
                clearBodyScrollStyles();
            }
        });
    };

    const clearBodyScrollStyles = () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
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

        ensureFeedbackUi();
        bindEvents();
        bindCheckoutFields();
        renderCheckoutFields();
        render();
    };

    window.LigeirinhoCartUI = {
        init,
        open,
        close,
        render,
        bindNavToggle,
        isOpen: isCartOpen,
        showAddedFeedback,
        burstConfetti,
    };
})();
