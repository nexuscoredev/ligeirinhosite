(function () {
    const WHATSAPP_PHONE = '5511970924909';
    const CART_KEY = 'ligeirinho-cart-v1';

    const grid = document.getElementById('catalog-grid');
    const filtersEl = document.getElementById('catalog-filters');
    const statsEl = document.getElementById('catalog-stats');
    const searchInputs = document.querySelectorAll('[data-catalog-search]');
    const sortSelect = document.getElementById('catalog-sort');

    const cartItemsEl = document.getElementById('cart-items');
    const cartItemsMobileEl = document.getElementById('cart-items-mobile');
    const cartTotalEl = document.getElementById('cart-total');
    const cartTotalMobileEl = document.getElementById('cart-total-mobile');
    const cartCountBadge = document.getElementById('cart-count-badge');
    const cartMobileBadge = document.getElementById('cart-mobile-badge');
    const cartWhatsappBtn = document.getElementById('cart-whatsapp-btn');
    const cartWhatsappBtnMobile = document.getElementById('cart-whatsapp-btn-mobile');
    const cartMobileFab = document.getElementById('cart-mobile-fab');
    const cartMobileSheet = document.getElementById('cart-mobile-sheet');

    if (!grid || !filtersEl) return;

    let catalog = null;
    let activeCategories = new Set();
    let searchQuery = '';

    const productImageUrl = (url) => {
        if (!url) return null;
        if (/\.(webp|jpg|jpeg|png|gif)(\?|$)/i.test(url)) return url;
        return `${url}.webp`;
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

    const loadCart = () => {
        try {
            return JSON.parse(localStorage.getItem(CART_KEY) || '{}');
        } catch {
            return {};
        }
    };

    const saveCart = (cart) => {
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
    };

    const cartEntries = (cart) => Object.values(cart).filter((item) => item.qty > 0);

    const cartItemCount = (cart) => cartEntries(cart).reduce((sum, item) => sum + item.qty, 0);

    const cartTotalValue = (cart) =>
        cartEntries(cart).reduce((sum, item) => sum + (item.price ?? 0) * item.qty, 0);

    const buildWhatsAppMessage = (cart) => {
        const items = cartEntries(cart);
        if (!items.length) return '';

        const lines = ['Olá! Gostaria de fazer um pedido:', ''];
        items.forEach((item) => {
            const unit = formatPrice(item.price);
            const subtotal = formatPrice((item.price ?? 0) * item.qty);
            lines.push(`${item.qty}x ${item.name} — ${unit} (subtotal ${subtotal})`);
        });
        lines.push('');
        lines.push(`Total: ${formatPrice(cartTotalValue(cart))}`);
        return lines.join('\n');
    };

    const buildWhatsAppUrl = (cart) => {
        const text = buildWhatsAppMessage(cart);
        if (!text) return '#';
        return `https://api.whatsapp.com/send/?phone=${WHATSAPP_PHONE}&text=${encodeURIComponent(text)}&type=phone_number&app_absent=0`;
    };

    const setWhatsAppButtons = (cart) => {
        const hasItems = cartItemCount(cart) > 0;
        const url = buildWhatsAppUrl(cart);
        [cartWhatsappBtn, cartWhatsappBtnMobile].forEach((btn) => {
            if (!btn) return;
            btn.href = hasItems ? url : '#';
            btn.classList.toggle('pointer-events-none', !hasItems);
            btn.classList.toggle('opacity-50', !hasItems);
            btn.setAttribute('aria-disabled', hasItems ? 'false' : 'true');
        });
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

    const renderCart = () => {
        const cart = loadCart();
        const items = cartEntries(cart);
        const count = cartItemCount(cart);
        const total = formatPrice(cartTotalValue(cart));
        const emptyHtml =
            '<p class="font-body-md text-sm text-on-surface-variant">Seu carrinho está vazio. Adicione produtos do catálogo.</p>';
        const listHtml = items.length ? items.map(cartLineHtml).join('') : emptyHtml;

        if (cartItemsEl) cartItemsEl.innerHTML = listHtml;
        if (cartItemsMobileEl) cartItemsMobileEl.innerHTML = listHtml;
        if (cartTotalEl) cartTotalEl.textContent = total;
        if (cartTotalMobileEl) cartTotalMobileEl.textContent = total;
        if (cartCountBadge) {
            cartCountBadge.textContent = count === 1 ? '1 item' : `${count} itens`;
        }
        if (cartMobileBadge) {
            cartMobileBadge.textContent = String(count);
            cartMobileBadge.classList.toggle('hidden', count === 0);
        }
        setWhatsAppButtons(cart);
    };

    const addToCart = (product) => {
        const cart = loadCart();
        if (!cart[product.id]) {
            cart[product.id] = {
                id: product.id,
                name: product.name,
                price: product.price,
                qty: 0,
            };
        }
        cart[product.id].qty += 1;
        saveCart(cart);
        renderCart();
    };

    const changeQty = (id, delta) => {
        const cart = loadCart();
        if (!cart[id]) return;
        cart[id].qty += delta;
        if (cart[id].qty <= 0) delete cart[id];
        saveCart(cart);
        renderCart();
    };

    const productCard = (product, categoryName) => {
        const subtitle = product.description || categoryName;
        const imgSrc = productImageUrl(product.image);
        const badge = product.adultOnly
            ? '<div class="absolute top-3 left-3 bg-surface-variant/50 border border-surface-variant text-on-surface-variant font-label-caps text-label-caps px-2 py-1 rounded">+18</div>'
            : '';

        const imageBlock = imgSrc
            ? `<img alt="" class="max-h-full max-w-full object-contain drop-shadow-2xl" src="${escapeHtml(imgSrc)}" loading="lazy" decoding="async">`
            : `<span class="material-symbols-outlined text-5xl text-on-surface-variant/40">liquor</span>`;

        return `<article class="product-card bg-surface-gray rounded-xl overflow-hidden border border-surface-variant/30 relative group flex flex-col transition-transform hover:-translate-y-1 duration-300" data-product-id="${product.id}">
<div class="product-glow absolute inset-0 bg-vibrant-orange/5 opacity-0 transition-opacity duration-300 rounded-xl pointer-events-none shadow-[0_0_15px_rgba(255,107,0,0.15)]"></div>
<div class="relative h-48 bg-surface-container flex items-center justify-center p-4">${badge}${imageBlock}</div>
<div class="p-5 flex-grow flex flex-col justify-between z-10">
<div>
<h2 class="font-headline-md text-headline-md text-on-surface text-lg mb-1 line-clamp-2">${escapeHtml(product.name)}</h2>
<p class="font-body-md text-sm text-on-surface-variant mb-4 line-clamp-2">${escapeHtml(subtitle)}</p>
</div>
<div class="flex items-center justify-between gap-3">
<span class="font-label-caps text-[16px] text-gold-accent shrink-0">${formatPrice(product.price)}</span>
<button type="button" class="catalog-add-btn bg-vibrant-orange hover:bg-primary-container text-deep-black font-bold p-2 rounded-lg transition-colors flex items-center justify-center" data-product-id="${product.id}" aria-label="Adicionar ao carrinho">
<span class="material-symbols-outlined">add_shopping_cart</span>
</button>
</div>
</div>
</article>`;
    };

    const getFilteredProducts = () => {
        const items = [];
        catalog.categories.forEach((cat) => {
            if (activeCategories.size && !activeCategories.has(cat.id)) return;
            cat.products.forEach((product) => {
                const haystack = `${product.name} ${product.description || ''} ${cat.name}`.toLowerCase();
                if (searchQuery && !haystack.includes(searchQuery)) return;
                items.push({ product, categoryName: cat.name });
            });
        });
        return items;
    };

    const sortItems = (items) => {
        const mode = sortSelect?.value || 'name';
        const sorted = [...items];
        if (mode === 'price-asc') {
            sorted.sort((a, b) => (a.product.price ?? 0) - (b.product.price ?? 0));
        } else if (mode === 'price-desc') {
            sorted.sort((a, b) => (b.product.price ?? 0) - (a.product.price ?? 0));
        } else {
            sorted.sort((a, b) => a.product.name.localeCompare(b.product.name, 'pt-BR'));
        }
        return sorted;
    };

    const productById = (id) => {
        for (const cat of catalog.categories) {
            const found = cat.products.find((p) => p.id === id);
            if (found) return found;
        }
        return null;
    };

    const renderProducts = () => {
        const items = sortItems(getFilteredProducts());
        statsEl.textContent = `Mostrando ${items.length} de ${catalog.totalProducts} produtos`;
        grid.innerHTML = items.map(({ product, categoryName }) => productCard(product, categoryName)).join('');
    };

    const renderFilters = () => {
        const allChecked = activeCategories.size === 0;
        filtersEl.innerHTML = `
<li>
<label class="flex items-center gap-3 cursor-pointer group">
<input type="checkbox" class="catalog-filter-all form-checkbox bg-deep-black border-surface-variant text-vibrant-orange focus:ring-vibrant-orange rounded" ${allChecked ? 'checked' : ''}>
<span class="text-on-surface group-hover:text-vibrant-orange transition-colors">Todos</span>
</label>
</li>
${catalog.categories
    .map(
        (cat) => `
<li>
<label class="flex items-center gap-3 cursor-pointer group">
<input type="checkbox" value="${cat.id}" class="catalog-filter form-checkbox bg-deep-black border-surface-variant text-vibrant-orange focus:ring-vibrant-orange rounded" ${activeCategories.has(cat.id) ? 'checked' : ''}>
<span class="text-on-surface-variant group-hover:text-vibrant-orange transition-colors">${escapeHtml(cat.name)}</span>
<span class="text-on-surface-variant/50 text-xs ml-auto">${cat.products.length}</span>
</label>
</li>`
    )
    .join('')}`;

        const allInput = filtersEl.querySelector('.catalog-filter-all');
        const catInputs = filtersEl.querySelectorAll('.catalog-filter');

        allInput?.addEventListener('change', () => {
            activeCategories.clear();
            catInputs.forEach((input) => {
                input.checked = false;
            });
            allInput.checked = true;
            renderProducts();
        });

        catInputs.forEach((input) => {
            input.addEventListener('change', () => {
                if (input.checked) {
                    activeCategories.add(input.value);
                } else {
                    activeCategories.delete(input.value);
                }
                allInput.checked = activeCategories.size === 0;
                renderProducts();
            });
        });
    };

    grid.addEventListener('click', (e) => {
        const btn = e.target.closest('.catalog-add-btn');
        if (!btn || !catalog) return;
        const product = productById(btn.dataset.productId);
        if (product) addToCart(product);
    });

    const removeFromCart = (id) => {
        const cart = loadCart();
        delete cart[id];
        saveCart(cart);
        renderCart();
    };

    const handleCartAction = (e) => {
        const minus = e.target.closest('.cart-qty-minus');
        const plus = e.target.closest('.cart-qty-plus');
        const remove = e.target.closest('.cart-remove');
        if (minus) changeQty(minus.dataset.id, -1);
        if (plus) changeQty(plus.dataset.id, 1);
        if (remove) removeFromCart(remove.dataset.id);
    };

    cartItemsEl?.addEventListener('click', handleCartAction);
    cartItemsMobileEl?.addEventListener('click', handleCartAction);

    cartMobileFab?.addEventListener('click', () => {
        cartMobileSheet?.classList.remove('hidden');
        cartMobileSheet?.setAttribute('aria-hidden', 'false');
    });

    cartMobileSheet?.querySelectorAll('[data-cart-close]').forEach((el) => {
        el.addEventListener('click', () => {
            cartMobileSheet.classList.add('hidden');
            cartMobileSheet.setAttribute('aria-hidden', 'true');
        });
    });

    searchInputs.forEach((input) => {
        input.addEventListener('input', () => {
            searchQuery = input.value.trim().toLowerCase();
            searchInputs.forEach((el) => {
                if (el !== input) el.value = input.value;
            });
            renderProducts();
        });
    });

    sortSelect?.addEventListener('change', renderProducts);

    renderCart();

    fetch('data/catalogo.json')
        .then((r) => {
            if (!r.ok) throw new Error('Catálogo não encontrado');
            return r.json();
        })
        .then((data) => {
            catalog = data;
            renderFilters();
            renderProducts();
        })
        .catch(() => {
            statsEl.textContent = 'Não foi possível carregar o catálogo.';
            grid.innerHTML =
                '<p class="col-span-full text-on-surface-variant font-body-md">Erro ao carregar <code class="text-gold-accent">data/catalogo.json</code>. Use um servidor local ou publique a pasta <code class="text-gold-accent">data/</code>.</p>';
        });
})();
