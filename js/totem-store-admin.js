(function () {
    let deps = {};
    let adminEditMode = false;
    let storeHiddenIds = new Set();
    let currentItem = null;
    let currentTier = 'caixa';
    let selectedScope = 'all';
    let saveBusy = false;

    const modal = () => document.getElementById('totem-deactivate-modal');
    const optionsEl = () => document.getElementById('totem-deactivate-options');
    const nameEl = () => document.getElementById('totem-deactivate-product-name');
    const errorEl = () => document.getElementById('totem-deactivate-error');
    const confirmBtn = () => document.getElementById('totem-deactivate-confirm');

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

    const pricing = () => deps.pricing || window.LigeirinhoProductPricing;
    const catalog = () => deps.catalog || window.LigeirinhoCatalog;

    const getHiddenIds = () => Array.from(storeHiddenIds);

    const isHidden = (productId) => storeHiddenIds.has(String(productId || '').trim());

    const variantForTier = (group, tier) => {
        if (!group) return null;
        return pricing()?.getVariant?.(group, tier) || group?.variants?.[tier] || null;
    };

    const hideKeysForVariant = (variant) => {
        if (!variant) return [];
        const keys = [String(variant.id || '').trim()];
        const cartKey = catalog()?.cartKeyFor?.(variant);
        if (cartKey) keys.push(String(cartKey).trim());
        return keys.filter(Boolean);
    };

    const isTierHidden = (group, tier) => {
        const variant = variantForTier(group, tier);
        if (!variant) return false;
        return hideKeysForVariant(variant).some((key) => isHidden(key));
    };

    const availableDeactivateTiers = (item) => {
        const group = item?.group;
        if (!group) return [];
        const tiers = [];
        ['unidade', 'caixa', 'pallet'].forEach((tier) => {
            if (group.variants?.[tier]?.price != null) tiers.push(tier);
        });
        return tiers;
    };

    const tierOptionCopy = (group, tier) => {
        const variant = variantForTier(group, tier);
        if (tier === 'unidade') {
            return { title: 'Unidade', sub: 'Somente a apresentação UN' };
        }
        if (tier === 'pallet') {
            return { title: 'Pallet', sub: 'Somente a apresentação PL' };
        }
        const size = Number(variant?.packSize) || 0;
        const title = size > 1 ? `Caixa (C/${size})` : 'Caixa';
        return { title, sub: 'Somente a apresentação CX' };
    };

    const allScopeSubtitle = (tiers) => {
        const labels = tiers.map((tier) => {
            if (tier === 'unidade') return 'unidade';
            if (tier === 'pallet') return 'pallet';
            return 'caixa';
        });
        if (!labels.length) return 'Todas as apresentações ativas';
        return `${labels.join(', ')} ativos`;
    };

    const isItemHidden = (item) => {
        if (!item?.product) return false;
        const group = item.group;
        if (!group) return isHidden(item.product.id);
        const tiers = availableDeactivateTiers(item);
        if (!tiers.length) return isHidden(item.product.id);
        return tiers.every((tier) => isTierHidden(group, tier));
    };

    const variantsForScope = (item, scope) => {
        const group = item?.group;
        if (!group) return [item?.product].filter(Boolean);
        const tiers = availableDeactivateTiers(item);
        if (scope === 'all') {
            return tiers.map((tier) => variantForTier(group, tier)).filter(Boolean);
        }
        const variant = variantForTier(group, scope);
        return variant ? [variant] : [];
    };

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

    const closeDeactivateModal = () => {
        const el = modal();
        if (!el) return;
        el.classList.remove('totem-deactivate-modal--open');
        el.setAttribute('aria-hidden', 'true');
        currentItem = null;
        currentTier = 'caixa';
        selectedScope = 'all';
        showError('');
        saveBusy = false;
        confirmBtn()?.removeAttribute('disabled');
    };

    const renderScopeOptions = (item) => {
        const el = optionsEl();
        if (!el || !item) return;
        const group = item.group;
        const tiers = availableDeactivateTiers(item);
        const options = [];

        if (group && tiers.length > 1) {
            options.push({
                value: 'all',
                title: 'Todos',
                sub: allScopeSubtitle(tiers),
            });
            tiers.forEach((tier) => {
                const copy = tierOptionCopy(group, tier);
                options.push({ value: tier, ...copy });
            });
        } else {
            options.push({
                value: 'all',
                title: 'Todos',
                sub: 'Ocultar este item no Totem',
            });
        }

        if (!options.some((opt) => opt.value === selectedScope)) {
            selectedScope = options[0]?.value || 'all';
        }

        el.innerHTML = options
            .map((opt) => {
                const active = opt.value === selectedScope;
                return `<label class="totem-deactivate-modal__option${active ? ' totem-deactivate-modal__option--active' : ''}">
<input type="radio" name="totem-deactivate-scope" value="${esc(opt.value)}"${active ? ' checked' : ''}>
<span class="totem-deactivate-modal__option-copy">
<span class="totem-deactivate-modal__option-title">${esc(opt.title)}</span>
<span class="totem-deactivate-modal__option-sub">${esc(opt.sub)}</span>
</span>
</label>`;
            })
            .join('');
    };

    const openDeactivateModal = (item, preferredTier = '') => {
        if (!item?.product || !modal()) return;
        currentItem = item;
        currentTier = String(preferredTier || item.defaultTier || 'caixa');
        selectedScope =
            preferredTier && availableDeactivateTiers(item).includes(preferredTier)
                ? preferredTier
                : 'all';
        if (nameEl()) {
            nameEl().textContent = item.group?.baseName || item.product.name || item.product.id;
        }
        renderScopeOptions(item);
        showError('');
        modal().classList.add('totem-deactivate-modal--open');
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

    const hideVariantOnStore = async (token, variant, productName) => {
        const productId = String(variant?.id || '').trim();
        if (!productId) return;
        const res = await fetch('/api/totem/admin/overrides', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                storeKey: resolveStoreKey(),
                productId,
                hubProductId: variant?.hubId || null,
                productName: productName || variant?.name || null,
                hidden: true,
            }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Não foi possível desativar.');
        storeHiddenIds = new Set((data.productIds || []).map((id) => String(id).trim()).filter(Boolean));
    };

    const confirmDeactivate = async () => {
        if (!currentItem?.product || saveBusy) return;
        const token = await deps.auth?.getHubAccessToken?.();
        if (!token) {
            showError('Sessão expirada. Saia e entre novamente no Totem.');
            return;
        }

        const variants = variantsForScope(currentItem, selectedScope);
        if (!variants.length) {
            showError('Nenhuma apresentação disponível para desativar.');
            return;
        }

        saveBusy = true;
        confirmBtn()?.setAttribute('disabled', 'true');
        showError('');

        const productName = currentItem.group?.baseName || currentItem.product.name || '';
        try {
            for (const variant of variants) {
                await hideVariantOnStore(token, variant, productName);
            }
            deps.onHiddenChange?.(getHiddenIds());
            closeDeactivateModal();
        } catch (err) {
            showError(err.message || 'Falha ao desativar.');
        } finally {
            saveBusy = false;
            confirmBtn()?.removeAttribute('disabled');
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

        document.getElementById('totem-deactivate-close')?.addEventListener('click', closeDeactivateModal);
        document.getElementById('totem-deactivate-cancel')?.addEventListener('click', closeDeactivateModal);
        modal()?.querySelector('.totem-deactivate-modal__backdrop')?.addEventListener('click', closeDeactivateModal);
        confirmBtn()?.addEventListener('click', () => {
            void confirmDeactivate();
        });

        optionsEl()?.addEventListener('change', (event) => {
            const input = event.target.closest('input[name="totem-deactivate-scope"]');
            if (!input) return;
            selectedScope = String(input.value || 'all');
            optionsEl()
                ?.querySelectorAll('.totem-deactivate-modal__option')
                .forEach((label) => {
                    const checked = label.querySelector('input')?.value === selectedScope;
                    label.classList.toggle('totem-deactivate-modal__option--active', checked);
                });
        });

        document.addEventListener('keydown', (e) => {
            const el = modal();
            if (e.key === 'Escape' && el?.classList.contains('totem-deactivate-modal--open')) {
                closeDeactivateModal();
            }
        });
    };

    const init = async (nextDeps) => {
        deps = nextDeps || {};
        closeDeactivateModal();
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
        openDeactivateModal,
        closeDeactivateModal,
        isHidden,
        isTierHidden,
        isItemHidden,
        getHiddenIds,
        updateAdminChrome,
    };
})();
