(function () {
    let deps = {};
    let adminEditMode = false;
    let storeHiddenIds = new Set();
    let currentItem = null;
    let saveBusy = false;

    const modal = () => document.getElementById('totem-store-item-modal');
    const hiddenInput = () => document.getElementById('totem-store-item-hidden');
    const errorEl = () => document.getElementById('totem-store-item-error');
    const nameEl = () => document.getElementById('totem-store-item-name');
    const priceEl = () => document.getElementById('totem-store-item-price');
    const mediaEl = () => document.getElementById('totem-store-item-media');
    const saveBtn = () => document.getElementById('totem-store-item-save');

    const esc = (value) =>
        String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');

    const normalizeStoreKey = (value) => {
        const key = String(value || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '-');
        return key || 'default';
    };

    const resolveStoreKey = () => normalizeStoreKey(deps.resolveStoreKey?.() || 'default');

    const isTotemAdmin = () => Boolean(deps.session?.()?.totemAdmin);

    const getHiddenIds = () => Array.from(storeHiddenIds);

    const isHidden = (productId) => storeHiddenIds.has(String(productId || '').trim());

    const setEditMode = (on) => {
        adminEditMode = Boolean(on);
        document.documentElement.classList.toggle('totem--admin-edit', adminEditMode);
        deps.adminBtn?.classList.toggle('totem-btn--admin-active', adminEditMode);
        deps.adminBtn?.setAttribute('aria-pressed', adminEditMode ? 'true' : 'false');
        deps.onModeChange?.(adminEditMode);
    };

    const toggleEditMode = () => {
        if (!isTotemAdmin()) return false;
        setEditMode(!adminEditMode);
        return adminEditMode;
    };

    const showError = (message) => {
        const el = errorEl();
        if (!el) return;
        if (!message) {
            el.hidden = true;
            el.textContent = '';
            return;
        }
        el.hidden = false;
        el.textContent = message;
    };

    const closeItemModal = () => {
        const el = modal();
        if (!el) return;
        el.classList.remove('totem-store-admin-modal--open');
        el.setAttribute('aria-hidden', 'true');
        currentItem = null;
        showError('');
        saveBusy = false;
        saveBtn()?.removeAttribute('disabled');
    };

    const openItemModal = (item) => {
        if (!item?.product || !modal()) return;
        currentItem = item;
        const product = item.product;
        const imgSrc = product.image ? deps.catalog?.productImageUrl?.(product.image) : '';
        if (nameEl()) nameEl().textContent = product.name || product.id;
        if (priceEl()) {
            priceEl().textContent = deps.formatPrice?.(product.price) || String(product.price ?? '');
        }
        if (mediaEl()) {
            mediaEl().innerHTML = imgSrc
                ? `<img src="${esc(imgSrc)}" alt="">`
                : '<span class="material-symbols-outlined" aria-hidden="true">liquor</span>';
        }
        if (hiddenInput()) hiddenInput().checked = isHidden(product.id);
        showError('');
        modal().classList.add('totem-store-admin-modal--open');
        modal().setAttribute('aria-hidden', 'false');
    };

    const loadHidden = async () => {
        const storeKey = resolveStoreKey();
        try {
            const res = await fetch(`/api/totem/store/overrides?store=${encodeURIComponent(storeKey)}`, {
                cache: 'no-store',
            });
            const data = await res.json();
            storeHiddenIds = new Set((data.productIds || []).map((id) => String(id).trim()).filter(Boolean));
            deps.onHiddenChange?.(getHiddenIds());
            return getHiddenIds();
        } catch {
            storeHiddenIds = new Set();
            deps.onHiddenChange?.([]);
            return [];
        }
    };

    const saveItemHidden = async () => {
        if (!currentItem?.product || saveBusy) return;
        const product = currentItem.product;
        const hidden = Boolean(hiddenInput()?.checked);
        const token = await deps.auth?.getHubAccessToken?.();
        if (!token) {
            showError('Sessão expirada. Saia e entre novamente no Totem.');
            return;
        }

        saveBusy = true;
        saveBtn()?.setAttribute('disabled', 'true');
        showError('');

        try {
            const res = await fetch('/api/totem/admin/overrides', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    storeKey: resolveStoreKey(),
                    productId: product.id,
                    hubProductId: product.hubId || null,
                    productName: product.name || null,
                    hidden,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Não foi possível salvar.');

            storeHiddenIds = new Set((data.productIds || []).map((id) => String(id).trim()).filter(Boolean));
            deps.onHiddenChange?.(getHiddenIds());
            closeItemModal();
        } catch (err) {
            showError(err.message || 'Falha ao salvar.');
        } finally {
            saveBusy = false;
            saveBtn()?.removeAttribute('disabled');
        }
    };

    const updateAdminChrome = () => {
        const show = Boolean(isTotemAdmin() && deps.showAdminChrome?.());
        if (deps.adminBtn) {
            deps.adminBtn.hidden = !show;
            if (!show) setEditMode(false);
        }
    };

    const bindEvents = () => {
        deps.adminBtn?.addEventListener('click', () => {
            toggleEditMode();
            deps.onBumpIdle?.();
        });

        document.getElementById('totem-store-item-close')?.addEventListener('click', closeItemModal);
        document.getElementById('totem-store-item-cancel')?.addEventListener('click', closeItemModal);
        modal()?.querySelector('.totem-store-admin-modal__backdrop')?.addEventListener('click', closeItemModal);
        saveBtn()?.addEventListener('click', saveItemHidden);

        document.addEventListener('keydown', (e) => {
            const el = modal();
            if (e.key === 'Escape' && el?.classList.contains('totem-store-admin-modal--open')) closeItemModal();
        });
    };

    const init = async (nextDeps) => {
        deps = nextDeps || {};
        closeItemModal();
        bindEvents();
        updateAdminChrome();
        if (isTotemAdmin()) await loadHidden();
    };

    window.LigeirinhoTotemStoreAdmin = {
        init,
        loadHidden,
        isTotemAdmin,
        isEditMode: () => adminEditMode,
        toggleEditMode,
        setEditMode,
        openItemModal,
        closeItemModal,
        isHidden,
        getHiddenIds,
        updateAdminChrome,
    };
})();
