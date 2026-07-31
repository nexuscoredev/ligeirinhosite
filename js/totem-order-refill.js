(function () {
    const TOTEM_PEDIDO_PREFIX = 'PED';
    const TOTEM_CODE_HEX_LENGTH = 4;
    const CART_PAY_CARD_SUFFIX = '::pay-card';

    let deps = {};
    let pending = null;
    let mappedLines = [];
    let lookupBusy = false;

    const modal = () => document.getElementById('totem-order-refill-modal');
    const titleEl = () => document.getElementById('totem-order-refill-title');
    const summaryEl = () => document.getElementById('totem-order-refill-summary');
    const itemsEl = () => document.getElementById('totem-order-refill-items');
    const warningEl = () => document.getElementById('totem-order-refill-warning');
    const mergeHintEl = () => document.getElementById('totem-order-refill-merge-hint');
    const errorEl = () => document.getElementById('totem-order-refill-error');
    const addBtn = () => document.getElementById('totem-order-refill-add');
    const replaceBtn = () => document.getElementById('totem-order-refill-replace');
    const mergeBtn = () => document.getElementById('totem-order-refill-merge');
    const cancelBtn = () => document.getElementById('totem-order-refill-cancel');
    const closeBtn = () => document.getElementById('totem-order-refill-close');
    const backdrop = () => document.getElementById('totem-order-refill-backdrop');

    const esc = (value) =>
        String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');

    const formatPrice = (value) =>
        Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const parseTotemOrderCode = (raw) => {
        const s = String(raw || '').trim().toUpperCase();
        const body = s.startsWith(TOTEM_PEDIDO_PREFIX)
            ? s.slice(TOTEM_PEDIDO_PREFIX.length).replace(/^[\s\-:.]*/, '')
            : s;
        const hex = body.replace(/[^a-fA-F0-9]/g, '').toLowerCase();
        return hex.length >= TOTEM_CODE_HEX_LENGTH ? hex.slice(0, TOTEM_CODE_HEX_LENGTH) : null;
    };

    const isPedSearchInput = (raw) => {
        const text = String(raw || '').trim();
        if (!text) return false;
        return /^ped\b/i.test(text) || parseTotemOrderCode(text) != null;
    };

    const baseCartKey = (cartKey) => String(cartKey || '').replace(/::pay-card$/, '');

    const cartHasItems = () => {
        const cartApi = deps.cartApi;
        if (!cartApi?.loadCart) return false;
        return Object.keys(cartApi.loadCart()).length > 0;
    };

    const showError = (message) => {
        const el = errorEl();
        if (!el) return;
        const text = String(message || '').trim();
        el.hidden = !text;
        el.textContent = text;
    };

    const closeModal = () => {
        const el = modal();
        if (!el) return;
        window.LigeirinhoTotemActivity?.suppressGhostClicks?.(360);
        el.classList.remove('totem-deactivate-modal--open');
        el.setAttribute('aria-hidden', 'true');
        pending = null;
        mappedLines = [];
        showError('');
        deps.onBumpIdle?.();
    };

    const openModal = () => {
        const el = modal();
        if (!el) return;
        el.classList.add('totem-deactivate-modal--open');
        el.setAttribute('aria-hidden', 'false');
        deps.onBumpIdle?.();
    };

    const renderModal = () => {
        if (!pending) return;
        const { order, lines, skipped } = pending;
        const units = lines.reduce((sum, line) => sum + line.qty, 0);
        const total = lines.reduce((sum, line) => sum + line.price * line.qty, 0);
        const hasCart = cartHasItems();

        if (titleEl()) {
            titleEl().textContent = `Pedido ${order.code || order.codeRaw}`;
        }
        if (summaryEl()) {
            summaryEl().textContent = `${units} ${units === 1 ? 'item' : 'itens'} · ${formatPrice(total)} (preços atuais)`;
        }
        if (itemsEl()) {
            itemsEl().innerHTML = lines
                .slice(0, 8)
                .map(
                    (line) =>
                        `<li class="totem-order-refill__item">${esc(line.qty)}× ${esc(line.name)} · ${esc(formatPrice(line.price))}</li>`,
                )
                .join('');
            if (lines.length > 8) {
                itemsEl().innerHTML += `<li class="totem-order-refill__item totem-order-refill__item--more">+ ${lines.length - 8} itens</li>`;
            }
        }
        if (warningEl()) {
            const parts = [];
            if (skipped.length) {
                parts.push(
                    `${skipped.length} ${skipped.length === 1 ? 'item não está' : 'itens não estão'} mais disponível no catálogo.`,
                );
            }
            warningEl().hidden = !parts.length;
            warningEl().textContent = parts.join(' ');
        }
        if (mergeHintEl()) {
            mergeHintEl().hidden = !hasCart;
            mergeHintEl().textContent = hasCart
                ? 'Seu carrinho já tem itens. Como deseja adicionar?'
                : '';
        }
        if (addBtn()) addBtn().hidden = hasCart || !lines.length;
        if (replaceBtn()) replaceBtn().hidden = !hasCart || !lines.length;
        if (mergeBtn()) mergeBtn().hidden = !hasCart || !lines.length;
    };

    const buildLineFromOrderItem = (item) => {
        const findDisplayItem = deps.findDisplayItem;
        const pricing = deps.pricing;
        const catalog = deps.catalog;
        const resolvePromoOffer = deps.resolvePromoOffer;
        if (!findDisplayItem || !pricing || !catalog) return null;

        const rawKey = String(item.cartKey || item.id || '').trim();
        const baseKey = baseCartKey(rawKey);
        if (!baseKey) return null;

        const payMode = item.payMode === 'card' || rawKey.endsWith(CART_PAY_CARD_SUFFIX) ? 'card' : 'pix';
        const packType = String(item.packType || 'caixa').toLowerCase();
        const displayItem = findDisplayItem(baseKey, null);
        if (!displayItem) return { ok: false, name: item.name };

        const group = displayItem.group;
        const variant = group ? pricing.getVariant(group, packType) : null;
        const product = displayItem.product;
        const variantKey = variant ? catalog.cartKeyFor(variant) : product.id;
        const cartKey = payMode === 'card' ? `${variantKey}${CART_PAY_CARD_SUFFIX}` : variantKey;
        const name = group
            ? pricing.cartItemName({ ...(variant || {}), tier: packType }, group)
            : product.name;

        const catalogPrice = Number((variant || product).price);
        let price = catalogPrice;
        let promoPatch = {};

        if (payMode !== 'card') {
            const autoOffer = resolvePromoOffer?.(variantKey, group?.key || product.id, packType);
            if (autoOffer?.promoPrice != null && Number.isFinite(Number(autoOffer.promoPrice))) {
                price = Number(autoOffer.promoPrice);
                const finalBase =
                    autoOffer.originalPrice != null && Number.isFinite(Number(autoOffer.originalPrice))
                        ? Number(autoOffer.originalPrice)
                        : catalogPrice;
                promoPatch = {
                    promoId: autoOffer.promoId,
                    isPromo: true,
                    originalPrice: finalBase,
                    discountPct:
                        finalBase > price ? Math.max(0, Math.round((1 - price / finalBase) * 100)) : 0,
                };
            }
        }

        return {
            ok: true,
            line: {
                id: (variant || product).id,
                cartKey,
                name,
                price,
                qty: Math.max(1, Math.min(99, Number(item.qty) || 1)),
                packType,
                categoryId: displayItem.categoryId || '',
                categoryName: displayItem.categoryName || '',
                ...(payMode === 'card' ? { payMode: 'card' } : {}),
                ...promoPatch,
            },
        };
    };

    const mapOrderToLines = (order) => {
        const lines = [];
        const skipped = [];
        (order?.items || []).forEach((item) => {
            const built = buildLineFromOrderItem(item);
            if (built?.ok) lines.push(built.line);
            else skipped.push({ name: item.name || built?.name || 'Item' });
        });
        return { lines, skipped };
    };

    const applyLines = (mode) => {
        const cartApi = deps.cartApi;
        if (!cartApi?.saveCart || !mappedLines.length) return false;

        const next = mode === 'merge' ? { ...cartApi.loadCart() } : {};
        mappedLines.forEach((line) => {
            const key = line.cartKey;
            if (!key) return;
            if (next[key]) {
                next[key].qty = Math.min(99, (Number(next[key].qty) || 0) + line.qty);
                next[key].price = line.price;
                if (line.promoId) {
                    next[key].promoId = line.promoId;
                    next[key].isPromo = true;
                    next[key].originalPrice = line.originalPrice;
                    next[key].discountPct = line.discountPct;
                } else if (line.payMode === 'card') {
                    next[key].payMode = 'card';
                    delete next[key].promoId;
                    delete next[key].isPromo;
                    delete next[key].originalPrice;
                    delete next[key].discountPct;
                }
            } else {
                next[key] = { ...line };
            }
        });

        cartApi.saveCart(next);
        deps.onCartChanged?.();
        deps.clearSearch?.();
        closeModal();
        deps.openCart?.();
        deps.onBumpIdle?.();
        return true;
    };

    const fetchAndOpen = async (raw) => {
        const code = parseTotemOrderCode(raw);
        if (!code || lookupBusy) return false;

        lookupBusy = true;
        showError('');
        deps.onBumpIdle?.();

        try {
            const res = await fetch(`/api/totem/order/items?code=${encodeURIComponent(raw.trim())}`, {
                cache: 'no-store',
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || 'Pedido não encontrado.');
            }

            const order = data.order;
            const { lines, skipped } = mapOrderToLines(order);
            if (!lines.length) {
                throw new Error(
                    skipped.length
                        ? 'Nenhum item deste pedido está disponível no catálogo atual.'
                        : 'Pedido sem itens.',
                );
            }

            pending = { order, lines, skipped };
            mappedLines = lines;
            renderModal();
            openModal();
            deps.onLookupSuccess?.();
            return true;
        } catch (err) {
            deps.onLookupError?.(err.message || 'Não foi possível buscar o pedido.');
            return false;
        } finally {
            lookupBusy = false;
        }
    };

    const tryFromSearch = (raw) => {
        const text = String(raw || '').trim();
        if (!isPedSearchInput(text)) return false;
        const code = parseTotemOrderCode(text);
        if (!code) return false;
        void fetchAndOpen(text);
        return true;
    };

    const bindEvents = () => {
        if (document.documentElement.dataset.totemOrderRefillBound) return;
        document.documentElement.dataset.totemOrderRefillBound = '1';
        addBtn()?.addEventListener('click', () => applyLines('replace'));
        replaceBtn()?.addEventListener('click', () => applyLines('replace'));
        mergeBtn()?.addEventListener('click', () => applyLines('merge'));
        cancelBtn()?.addEventListener('click', closeModal);
        closeBtn()?.addEventListener('click', closeModal);
        backdrop()?.addEventListener('click', (e) => {
            if (deps.guardGhostClick?.(e)) return;
            closeModal();
        });
        document.addEventListener('keydown', (event) => {
            const el = modal();
            if (event.key === 'Escape' && el?.classList.contains('totem-deactivate-modal--open')) {
                closeModal();
            }
        });
    };

    const init = (nextDeps) => {
        deps = nextDeps || {};
        closeModal();
        bindEvents();
    };

    window.LigeirinhoTotemOrderRefill = {
        init,
        isPedSearchInput,
        tryFromSearch,
        parseTotemOrderCode,
        closeModal,
    };
})();
