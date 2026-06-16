(function () {
    const LG_QUERY = '(min-width: 1024px)';
    const PAY_BTN_LABEL = 'Pagar com Mercado Pago';
    const MP_PAY_LOGO = 'img/mercado-pago-logo-white-horizontal.svg';
    const payBtnInnerHtml = () =>
        `<img src="${MP_PAY_LOGO}" alt="" class="lig-mp-pay-logo" width="108" height="27" decoding="async">`;

    const setPayButtonContent = (btn, mode = 'default') => {
        if (!btn) return;
        if (mode === 'loading') {
            btn.textContent = 'Processando…';
            btn.classList.add('lig-cart-mp-btn--loading');
            return;
        }
        btn.classList.remove('lig-cart-mp-btn--loading');
        btn.innerHTML = payBtnInnerHtml();
    };

    const cartShellHtml = `
<div id="cart-panel" class="fixed bottom-8 right-8 z-[70] hidden w-[min(100vw-2rem,26rem)] max-w-[calc(100vw-2rem)] flex-col" role="dialog" aria-modal="true" aria-labelledby="cart-panel-title">
<div class="lig-cart-panel rounded-xl p-5 flex flex-col max-h-[calc(100vh-6rem)]">
<div class="lig-cart-header">
<div class="lig-cart-header__brand" id="cart-panel-title">
<span class="material-symbols-outlined lig-cart-header__icon" aria-hidden="true">local_shipping</span>
<span class="lig-cart-header__title">Seu caminhão</span>
</div>
<div class="lig-cart-header__actions">
<span id="cart-count-badge" class="lig-cart-header__count">0 itens</span>
<button type="button" class="lig-cart-header__close" data-cart-close aria-label="Fechar caminhão">
<span class="material-symbols-outlined" aria-hidden="true">close</span>
</button>
</div>
</div>
<div class="lig-cart-scroll">
<div id="cart-items" class="lig-cart-items"></div>
<a href="pedidos.html" class="lig-cart-continue" id="cart-continue-link">Continuar comprando</a>
<div class="cart-checkout lig-cart-checkout shrink-0">
<p class="lig-cart-checkout__label">Detalhes do pedido</p>
<div class="lig-cart-checkout__delivery">
<label class="lig-cart-checkout-label">
<input type="radio" name="cart-delivery-panel" value="entrega" class="sr-only" data-checkout="deliveryType"> Entrega
</label>
<label class="lig-cart-checkout-label">
<input type="radio" name="cart-delivery-panel" value="retirada" class="sr-only" data-checkout="deliveryType"> Retirada
</label>
</div>
<input type="text" data-checkout="address" placeholder="Endereço completo (rua, nº, bairro)" class="lig-cart-input" autocomplete="street-address">
<p class="lig-cart-checkout__error hidden" data-checkout-error="address" role="alert"></p>
<textarea data-checkout="notes" placeholder="Observações para o entregador (opcional)" rows="2" class="lig-cart-input lig-cart-input--area"></textarea>
<p class="lig-cart-checkout__hint">Pix, cartão de crédito ou débito via Mercado Pago.</p>
</div>
<div id="cart-summary" class="lig-cart-summary-wrap shrink-0"></div>
</div>
<div class="lig-cart-footer shrink-0">
<div class="lig-cart-footer__total">
<span class="lig-cart-footer__label">Total</span>
<span id="cart-total" class="lig-cart-footer__value">R$ 0,00</span>
</div>
<button type="button" id="cart-pay-btn" class="lig-cart-mp-btn w-full py-3 rounded-full transition-colors flex items-center justify-center pointer-events-none opacity-50" disabled aria-disabled="true" aria-label="${PAY_BTN_LABEL}">
${payBtnInnerHtml()}
</button>
</div>
</div>
</div>
<div id="cart-mobile-sheet" class="fixed inset-0 z-[70] hidden" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="cart-sheet-title">
<div class="absolute inset-0 lig-cart-overlay" data-cart-close></div>
<div class="absolute bottom-0 left-0 right-0 lig-cart-sheet rounded-t-2xl p-5 max-h-[85vh] flex flex-col">
<div class="lig-cart-header lig-cart-header--sheet">
<div class="lig-cart-header__brand" id="cart-sheet-title">
<span class="material-symbols-outlined lig-cart-header__icon" aria-hidden="true">local_shipping</span>
<span class="lig-cart-header__title">Seu caminhão</span>
</div>
<button type="button" class="lig-cart-header__close" data-cart-close aria-label="Fechar caminhão">
<span class="material-symbols-outlined" aria-hidden="true">close</span>
</button>
</div>
<div class="lig-cart-scroll">
<div id="cart-items-mobile" class="lig-cart-items"></div>
<div class="cart-checkout lig-cart-checkout shrink-0">
<p class="lig-cart-checkout__label">Detalhes do pedido</p>
<div class="lig-cart-checkout__delivery">
<label class="lig-cart-checkout-label">
<input type="radio" name="cart-delivery-mobile" value="entrega" class="sr-only" data-checkout="deliveryType"> Entrega
</label>
<label class="lig-cart-checkout-label">
<input type="radio" name="cart-delivery-mobile" value="retirada" class="sr-only" data-checkout="deliveryType"> Retirada
</label>
</div>
<input type="text" data-checkout="address" placeholder="Endereço completo (rua, nº, bairro)" class="lig-cart-input" autocomplete="street-address">
<textarea data-checkout="notes" placeholder="Observações (opcional)" rows="2" class="lig-cart-input lig-cart-input--area"></textarea>
<p class="lig-cart-checkout__hint">Pix, cartão de crédito ou débito via Mercado Pago.</p>
</div>
</div>
<div class="lig-cart-footer shrink-0">
<div class="lig-cart-footer__total">
<span class="lig-cart-footer__label">Total</span>
<span id="cart-total-mobile" class="lig-cart-footer__value">R$ 0,00</span>
</div>
<button type="button" id="cart-pay-btn-mobile" class="lig-cart-mp-btn w-full py-3 rounded-full flex items-center justify-center pointer-events-none opacity-50" disabled aria-label="${PAY_BTN_LABEL}">${payBtnInnerHtml()}</button>
</div>
</div>
</div>`;

    let panel;
    let sheet;
    let cartApi;
    let scrollLockY = 0;
    let toastHideTimer = null;
    let undoRemoveSnapshot = null;
    let undoRemoveTimer = null;
    let undoHideTimer = null;

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
<p class="text-sm font-semibold lig-cart-text leading-tight">Adicionado ao caminhão</p>
<p id="cart-add-toast-name" class="text-xs lig-cart-text-muted truncate mt-0.5"></p>
</div>
<button type="button" id="cart-add-toast-open" class="shrink-0 text-xs font-bold text-vibrant-yellow hover:text-[#D9BB35] px-2 py-1 rounded-md min-h-[36px]">Ver</button>
</div>`;
            document.body.appendChild(toast);

            toast.querySelector('#cart-add-toast-open')?.addEventListener('click', () => {
                hideAddToast();
                if (window.matchMedia(LG_QUERY).matches) open();
                else window.location.href = 'caminhao.html';
            });
        }

        if (!document.getElementById('cart-undo-toast')) {
            const undo = document.createElement('div');
            undo.id = 'cart-undo-toast';
            undo.className =
                'fixed z-[80] bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-4 right-4 md:bottom-8 md:left-auto md:right-8 md:max-w-sm hidden';
            undo.setAttribute('role', 'status');
            undo.innerHTML = `<div class="lig-toast-inner flex items-center gap-3 rounded-xl px-4 py-3">
<p class="text-sm font-semibold lig-cart-text min-w-0 flex-1 truncate" id="cart-undo-toast-text">Item removido</p>
<button type="button" id="cart-undo-toast-btn" class="shrink-0 text-xs font-bold text-vibrant-yellow hover:text-[#D9BB35] px-2 py-1 rounded-md min-h-[36px]">Desfazer</button>
</div>`;
            document.body.appendChild(undo);
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
        if (live) live.textContent = `${label} adicionado ao caminhão.`;

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

    const formatPrice = (value) => cartApi?.formatMoney?.(value) ?? '—';

    const escapeHtml = (str) =>
        String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

    const lineThumbHtml = (item, className = 'lig-cart-line__thumb') => {
        const src = item.image ? escapeHtml(item.image) : '';
        if (src) {
            return `<img src="${src}" alt="" class="${className}" loading="lazy" width="52" height="52">`;
        }
        return `<span class="${className} ${className}--placeholder" aria-hidden="true"><span class="material-symbols-outlined">liquor</span></span>`;
    };

    const cartLineHtml = (item) => {
        const lineKey = item.cartKey || item.id;
        const meta = cartApi?.itemMetaText?.(item) || `${item.qty}x · ${formatPrice((item.price ?? 0) * item.qty)}`;
        return `<article class="lig-cart-line" data-cart-line="${escapeHtml(lineKey)}">
${lineThumbHtml(item)}
<div class="lig-cart-line__info">
<p class="lig-cart-line__name">${escapeHtml(item.name)}</p>
<p class="lig-cart-line__meta">${escapeHtml(meta)}</p>
</div>
<div class="lig-cart-line__stepper" aria-label="Quantidade">
<button type="button" class="lig-cart-line__btn lig-cart-line__btn--minus cart-qty-minus" data-id="${escapeHtml(lineKey)}" aria-label="Diminuir">−</button>
<span class="lig-cart-line__qty">${item.qty}</span>
<button type="button" class="lig-cart-line__btn lig-cart-line__btn--plus cart-qty-plus" data-id="${escapeHtml(lineKey)}" aria-label="Aumentar">+</button>
</div>
<button type="button" class="lig-cart-line__remove cart-remove" data-id="${escapeHtml(lineKey)}" aria-label="Remover">
<span class="material-symbols-outlined" aria-hidden="true">close</span>
</button>
</article>`;
    };

    const summaryHtml = (cart) => {
        const { units, subtotal } = cartApi.cartSummary(cart);
        const unitsLabel = units === 1 ? '1 item' : `${units} itens`;
        return `<div class="lig-cart-summary">
<div class="lig-cart-summary__row"><span>Subtotal (${unitsLabel})</span><span>${formatPrice(subtotal)}</span></div>
<div class="lig-cart-summary__row lig-cart-summary__row--total"><span>Total</span><strong>${formatPrice(subtotal)}</strong></div>
</div>`;
    };

    const updateCheckoutErrors = (cart) => {
        const checkout = cartApi.loadCheckout();
        const needsAddress = checkout.deliveryType === 'entrega';
        const addressOk = !needsAddress || Boolean(checkout.address?.trim());
        const message = needsAddress && !addressOk ? 'Informe o endereço completo para entrega.' : '';
        document.querySelectorAll('[data-checkout-error="address"]').forEach((el) => {
            el.textContent = message;
            el.classList.toggle('hidden', !message);
        });
        document.querySelectorAll('[data-checkout="address"]').forEach((el) => {
            el.classList.toggle('lig-cart-input--error', Boolean(message));
            el.classList.toggle('caminhao-input--error', Boolean(message));
            el.setAttribute('aria-invalid', message ? 'true' : 'false');
        });
        return { needsAddress, addressOk, canCheckout: cartApi.cartItemCount(cart) > 0 && addressOk };
    };

    const updateFloatCart = (cart) => {
        let floatEl = document.getElementById('ze-float-cart');
        if (!floatEl) {
            floatEl = document.createElement('div');
            floatEl.id = 'ze-float-cart';
            floatEl.innerHTML = `<button type="button" class="ze-float-cart__btn" id="ze-float-cart-btn" aria-label="Abrir caminhão">
<span class="ze-float-cart__action">
<span class="ze-float-cart__icon" aria-hidden="true">
<span class="material-symbols-outlined">local_shipping</span>
<span class="ze-float-cart__badge" id="ze-float-count">0</span>
</span>
<span class="ze-float-cart__copy">
<span class="ze-float-cart__title">Ver caminhão</span>
<span class="ze-float-cart__meta" id="ze-float-meta">0 itens</span>
</span>
</span>
<span class="ze-float-cart__total" id="ze-float-total">R$ 0,00</span>
</button>`;
            document.body.appendChild(floatEl);
            floatEl.querySelector('#ze-float-cart-btn')?.addEventListener('click', open);
        }

        const count = cartApi.cartItemCount(cart);
        const total = formatPrice(cartApi.cartTotalValue(cart));
        const countEl = document.getElementById('ze-float-count');
        const totalEl = document.getElementById('ze-float-total');
        const metaEl = document.getElementById('ze-float-meta');
        const btn = document.getElementById('ze-float-cart-btn');

        if (countEl) countEl.textContent = count > 99 ? '99+' : String(count);
        if (totalEl) totalEl.textContent = total;
        if (metaEl) metaEl.textContent = count === 1 ? '1 item' : `${count} itens`;
        if (btn) {
            btn.setAttribute(
                'aria-label',
                count === 1 ? `Ver caminhão, 1 item, total ${total}` : `Ver caminhão, ${count} itens, total ${total}`
            );
        }

        const visible = count > 0 && !isCartOpen() && document.body.dataset.page !== 'caminhao';
        floatEl.classList.toggle('ze-float-cart--visible', visible);
        document.documentElement.classList.toggle('lig-has-float-cart', count > 0);
    };

    const setPayButtons = (cart) => {
        const { canCheckout } = updateCheckoutErrors(cart);

        ['cart-pay-btn', 'cart-pay-btn-mobile'].forEach((id) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.disabled = !canCheckout;
            btn.classList.toggle('pointer-events-none', !canCheckout);
            btn.classList.toggle('opacity-50', !canCheckout);
            btn.setAttribute('aria-disabled', canCheckout ? 'false' : 'true');
        });
    };

    const renderCheckoutFields = () => {
        const checkout = cartApi.loadCheckout();
        document.querySelectorAll('.cart-checkout').forEach((section) => {
            section.querySelectorAll('[data-checkout="deliveryType"]').forEach((input) => {
                input.checked = input.value === checkout.deliveryType;
            });
            const addressEl = section.querySelector('[data-checkout="address"]');
            const notesEl = section.querySelector('[data-checkout="notes"]');
            if (addressEl) {
                addressEl.value = checkout.address || '';
                addressEl.closest('.cart-checkout')?.classList.toggle('cart-checkout--retirada', checkout.deliveryType === 'retirada');
                addressEl.classList.toggle('hidden', checkout.deliveryType === 'retirada');
            }
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
                    payment: 'mercado_pago',
                    notes: section?.querySelector('[data-checkout="notes"]')?.value || '',
                });
                renderCheckoutFields();
                setPayButtons(cartApi.loadCart());
            });
            if (field.tagName === 'TEXTAREA' || field.tagName === 'INPUT') {
                field.addEventListener('input', () => {
                    const section = field.closest('.cart-checkout');
                    const deliveryInput = section?.querySelector('[data-checkout="deliveryType"]:checked');
                    cartApi.saveCheckout({
                        deliveryType: deliveryInput?.value || 'entrega',
                        address: section?.querySelector('[data-checkout="address"]')?.value || '',
                        payment: 'mercado_pago',
                        notes: section?.querySelector('[data-checkout="notes"]')?.value || '',
                    });
                    setPayButtons(cartApi.loadCart());
                });
            }
        });
    };

    const resetCartScroll = () => {
        document.querySelectorAll('.lig-cart-scroll').forEach((el) => {
            el.scrollTop = 0;
        });
    };

    const render = () => {
        if (!cartApi) return;
        const cart = cartApi.loadCart();
        const items = cartApi.cartEntries(cart);
        const count = cartApi.cartItemCount(cart);
        const total = formatPrice(cartApi.cartTotalValue(cart));
        const emptyHtml = cartApi.lastOrderSummary()
            ? `<div class="lig-cart-empty"><p class="lig-cart-empty__text">Seu caminhão está vazio.</p>
<button type="button" id="cart-reorder-btn" class="lig-cart-empty__btn">Repetir último pedido</button>
<p class="lig-cart-empty__link"><a href="pedidos.html">Adicionar produtos</a></p></div>`
            : `<div class="lig-cart-empty"><p class="lig-cart-empty__text">Seu caminhão está vazio. <a href="pedidos.html">Adicionar produtos</a></p></div>`;
        const listHtml = items.length ? items.map(cartLineHtml).join('') : emptyHtml;

        const cartItemsEl = document.getElementById('cart-items');
        const cartItemsMobileEl = document.getElementById('cart-items-mobile');
        const cartTotalEl = document.getElementById('cart-total');
        const cartTotalMobileEl = document.getElementById('cart-total-mobile');
        const cartCountBadge = document.getElementById('cart-count-badge');
        const cartSummaryEl = document.getElementById('cart-summary');
        const continueLink = document.getElementById('cart-continue-link');

        if (cartItemsEl) cartItemsEl.innerHTML = listHtml;
        if (cartItemsMobileEl) cartItemsMobileEl.innerHTML = listHtml;
        if (cartTotalEl) cartTotalEl.textContent = total;
        if (cartTotalMobileEl) cartTotalMobileEl.textContent = total;
        if (cartSummaryEl) cartSummaryEl.innerHTML = items.length ? summaryHtml(cart) : '';
        if (continueLink) continueLink.classList.toggle('hidden', !items.length);
        if (cartCountBadge) {
            cartCountBadge.textContent = count === 1 ? '1 item' : `${count} itens`;
        }
        setPayButtons(cart);
        cartApi.updateNavCartBadge();
        renderCheckoutFields();
        updateFloatCart(cart);
        resetCartScroll();
    };

    const changeQty = (id, delta) => {
        const cart = cartApi.loadCart();
        if (!cart[id]) return;
        cart[id].qty += delta;
        if (cart[id].qty <= 0) delete cart[id];
        cartApi.saveCart(cart);
        render();
    };

    const hideUndoToast = () => {
        const undo = document.getElementById('cart-undo-toast');
        if (!undo) return;
        undo.classList.add('hidden');
    };

    const showUndoRemove = (productName, onUndo) => {
        ensureFeedbackUi();
        hideAddToast();
        const undo = document.getElementById('cart-undo-toast');
        const text = document.getElementById('cart-undo-toast-text');
        const btn = document.getElementById('cart-undo-toast-btn');
        if (!undo || !text || !btn) return;
        text.textContent = `${shortProductName(productName)} removido`;
        undo.classList.remove('hidden');
        const handler = () => {
            btn.removeEventListener('click', handler);
            onUndo?.();
        };
        btn.addEventListener('click', handler);
        window.clearTimeout(undoHideTimer);
        undoHideTimer = window.setTimeout(() => {
            undoRemoveSnapshot = null;
            hideUndoToast();
        }, 5000);
    };

    const removeFromCart = (id) => {
        const cart = cartApi.loadCart();
        const item = cart[id];
        if (!item) return;
        undoRemoveSnapshot = { id, item: { ...item } };
        window.clearTimeout(undoRemoveTimer);
        delete cart[id];
        cartApi.saveCart(cart);
        render();
        showUndoRemove(item.name, () => {
            if (!undoRemoveSnapshot) return;
            const next = cartApi.loadCart();
            next[undoRemoveSnapshot.id] = { ...undoRemoveSnapshot.item };
            cartApi.saveCart(next);
            undoRemoveSnapshot = null;
            window.clearTimeout(undoHideTimer);
            hideUndoToast();
            render();
        });
        undoRemoveTimer = window.setTimeout(() => {
            undoRemoveSnapshot = null;
        }, 5000);
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

    const openDeliveryAddress = () => {
        const checkout = cartApi.loadCheckout();
        if (checkout.deliveryType !== 'entrega') {
            cartApi.saveCheckout({ deliveryType: 'entrega' });
            renderCheckoutFields();
        }
        open({ focusAddress: true });
    };

    const open = (options = {}) => {
        if (!panel || !sheet) return;
        window.LigeirinhoNav?.closeMobileMenu?.();
        if (options.focusAddress) {
            const checkout = cartApi.loadCheckout();
            if (checkout.deliveryType !== 'entrega') {
                cartApi.saveCheckout({ deliveryType: 'entrega' });
            }
        }
        render();
        if (window.matchMedia(LG_QUERY).matches) {
            sheet.classList.add('hidden');
            sheet.setAttribute('aria-hidden', 'true');
            panel.classList.remove('hidden');
            panel.classList.add('flex');
            resetCartScroll();
            if (options.focusAddress) {
                window.requestAnimationFrame(() => {
                    const addressEl = panel.querySelector('[data-checkout="address"]');
                    addressEl?.focus?.();
                    addressEl?.scrollIntoView?.({ block: 'nearest' });
                });
            }
        } else {
            const url = new URL('caminhao.html', window.location.href);
            if (options.focusAddress) {
                cartApi.saveCheckout({ deliveryType: 'entrega' });
                url.hash = 'endereco';
            }
            window.location.href = url.toString();
        }
        updateFloatCart(cartApi.loadCart());
    };

    const startAppPayment = async (buttonIds = ['cart-pay-btn', 'cart-pay-btn-mobile']) => {
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

        const payButtons = Array.isArray(buttonIds) ? buttonIds : ['cart-pay-btn', 'cart-pay-btn-mobile'];
        payButtons.forEach((id) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.disabled = true;
                setPayButtonContent(btn, 'loading');
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
                    paymentMethod: 'mercado_pago',
                    hubUserId: session?.hubUserId || '',
                    customer: {
                        name: session?.name || '',
                        phone: session?.phone || '',
                        email: session?.email || '',
                        hubUserId: session?.hubUserId || '',
                    },
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Não foi possível iniciar o pagamento');

            cartApi.saveLastOrder(cart, checkout);
            cartApi.saveCheckout({ payment: 'mercado_pago' });
            window.location.href = `pagamento.html?order=${encodeURIComponent(data.orderId)}`;
        } catch (err) {
            window.alert(err.message || 'Erro ao iniciar pagamento. Tente novamente.');
            payButtons.forEach((id) => {
                const btn = document.getElementById(id);
                if (btn) {
                    btn.disabled = false;
                    setPayButtonContent(btn);
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

        ['cart-pay-btn', 'cart-pay-btn-mobile'].forEach((id) => {
            document.getElementById(id)?.addEventListener('click', startAppPayment);
        });

        sheet?.querySelectorAll('[data-cart-close]').forEach((el) => {
            el.addEventListener('click', close);
        });

        panel?.querySelectorAll('[data-cart-close]').forEach((el) => {
            el.addEventListener('click', close);
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') close();
        });

        window.addEventListener('ligeirinho-cart-changed', render);
        window.addEventListener('ligeirinho-checkout-changed', () => {
            renderCheckoutFields();
            setPayButtons(cartApi.loadCart());
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
            if (window.matchMedia(LG_QUERY).matches) {
                const panelOpen = panel && !panel.classList.contains('hidden');
                if (panelOpen) close();
                else open();
            } else {
                window.location.href = 'caminhao.html';
            }
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
        openDeliveryAddress,
        close,
        render,
        bindNavToggle,
        isOpen: isCartOpen,
        showAddedFeedback,
        burstConfetti,
        startPayment: startAppPayment,
        payButtonHtml: payBtnInnerHtml,
        payButtonLabel: PAY_BTN_LABEL,
        setPayButtonContent,
        cartLineHtml,
        lineThumbHtml,
        summaryHtml,
        updateCheckoutErrors,
        removeFromCart,
    };
})();
