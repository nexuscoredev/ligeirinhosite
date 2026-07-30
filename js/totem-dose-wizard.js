(function () {
    const STEPS = [
        { id: 'tamanho', label: 'Tamanho', title: 'Tamanho', lead: 'Escolha o copo' },
        { id: 'gelo', label: 'Gelo', title: 'Gelo', lead: 'Escolha o gelo' },
        { id: 'dose', label: 'Dose', title: 'Dose', lead: 'Escolha a dose' },
        { id: 'energetico', label: 'Energético', title: 'Energético', lead: 'Escolha o energético' },
        { id: 'review', label: 'Carrinho', title: 'Sua dose', lead: 'Revise e adicione ao carrinho' },
    ];

    let ctx = null;
    let stepIndex = 0;
    let selections = { tamanho: null, gelo: null, dose: null, energetico: null };
    let addedToCart = false;

    const els = {
        view: null,
        back: null,
        progress: null,
        eyebrow: null,
        title: null,
        lead: null,
        picker: null,
        options: null,
        review: null,
        reviewList: null,
        total: null,
        addBtn: null,
        finishBtn: null,
        empty: null,
        emptyLead: null,
    };

    const extractMl = (name) => {
        const match = String(name || '').match(/(\d{2,4})\s*ml/i);
        return match ? Number(match[1]) : 0;
    };

    const isItemHidden = (item) => Boolean(ctx?.isItemHidden?.(item));

    const itemLabel = (item, stepId) => {
        if (!item) return '';
        if (stepId === 'tamanho') {
            const ml = extractMl(item.product.name);
            if (ml) return `Copo ${ml} ml`;
        }
        return item.group?.baseName || item.product.name;
    };

    const resolveVariant = (item, tier = 'unidade') => {
        if (!item || !ctx?.pricing || !ctx?.catalog) return null;
        const group = item.group;
        if (group) {
            const tiers = ctx.pricing.getTotemAvailableTiers?.(group) || ctx.pricing.getAvailableTiers?.(group) || [];
            const preferred = tiers.includes(tier) ? tier : tiers[0] || tier;
            return ctx.pricing.getVariant(group, preferred);
        }
        return {
            id: item.product.id,
            name: item.product.name,
            price: item.product.price,
            tier: item.defaultTier || 'unidade',
            image: item.product.image,
        };
    };

    const resolveAddPayload = (item, tier = 'unidade') => {
        const group = item.group;
        const variant = resolveVariant(item, tier);
        const cartKey = group && variant ? ctx.catalog.cartKeyFor(variant) : item.product.id;
        const itemKey = group?.key || item.product.id;
        const packTier = variant?.tier || tier;
        return { cartKey, itemKey, tier: packTier, variant };
    };

    const itemPrice = (item) => {
        const variant = resolveVariant(item, 'unidade');
        return Number(variant?.price ?? item.product.price) || 0;
    };

    const dedupeByKey = (items, keyFn) => {
        const map = new Map();
        for (const item of items) {
            const key = keyFn(item);
            if (!key) continue;
            const existing = map.get(key);
            if (!existing) {
                map.set(key, item);
                continue;
            }
            const existingUn = resolveVariant(existing, 'unidade')?.tier === 'unidade';
            const currentUn = resolveVariant(item, 'unidade')?.tier === 'unidade';
            if (currentUn && !existingUn) map.set(key, item);
        }
        return [...map.values()];
    };

    const filterCopo = (items) => {
        const copos = items.filter(
            (item) =>
                !isItemHidden(item) &&
                /copo/i.test(item.product.name) &&
                (item.categoryId === 'descartavel' || /descart/i.test(item.categoryName || '')),
        );
        return dedupeByKey(copos, (item) => extractMl(item.product.name) || item.product.id).sort(
            (a, b) => extractMl(a.product.name) - extractMl(b.product.name),
        );
    };

    const filterGelo = (items) =>
        dedupeByKey(
            items.filter((item) => !isItemHidden(item) && item.categoryId === 'gelos'),
            (item) => item.group?.key || item.product.id,
        ).sort((a, b) => itemLabel(a).localeCompare(itemLabel(b), 'pt-BR'));

    const filterEnergetico = (items) =>
        dedupeByKey(
            items.filter((item) => !isItemHidden(item) && item.categoryId === 'energeticos'),
            (item) => item.group?.key || item.product.id,
        ).sort((a, b) => itemLabel(a).localeCompare(itemLabel(b), 'pt-BR'));

    const isDoseCategory = (item) => {
        const catId = String(item.categoryId || '').toLowerCase();
        const catName = String(item.categoryName || '').toLowerCase();
        const configured = (ctx.getDoseCategorySlugs?.() || []).map((slug) => String(slug || '').toLowerCase()).filter(Boolean);
        if (configured.length && configured.includes(catId)) return true;
        if (/^doses?(-|$)/.test(catId)) return true;
        if (/\bdoses?\b/.test(catName)) return true;
        return /\bdoses?\b/.test(catId);
    };

    const filterDose = (items) => {
        let doses = items.filter((item) => !isItemHidden(item) && isDoseCategory(item));
        const doseCategoryOnly = Boolean(ctx.doseCategoryOnly?.());
        if (!doses.length && !doseCategoryOnly) {
            doses = items.filter(
                (item) =>
                    !isItemHidden(item) &&
                    item.categoryId === 'destilados' &&
                    (!item.group || (ctx.pricing.getTotemAvailableTiers?.(item.group) || []).includes('unidade')),
            );
        }
        return dedupeByKey(doses, (item) => item.group?.key || item.product.id).sort((a, b) =>
            itemLabel(a).localeCompare(itemLabel(b), 'pt-BR'),
        );
    };

    const stepFilters = {
        tamanho: filterCopo,
        gelo: filterGelo,
        dose: filterDose,
        energetico: filterEnergetico,
    };

    const currentStep = () => STEPS[stepIndex] || STEPS[0];

    const renderProgress = () => {
        if (!els.progress) return;
        els.progress.innerHTML = STEPS.map((step, index) => {
            const done = index < stepIndex || (step.id === 'review' && addedToCart);
            const active = index === stepIndex;
            const classes = [
                'totem-dose-wizard__progress-item',
                done ? 'totem-dose-wizard__progress-item--done' : '',
                active ? 'totem-dose-wizard__progress-item--active' : '',
            ]
                .filter(Boolean)
                .join(' ');
            return `<li class="${classes}" aria-current="${active ? 'step' : 'false'}"><span>${ctx.esc(step.label)}</span></li>`;
        }).join('');
    };

    const renderHeader = () => {
        const step = currentStep();
        if (els.eyebrow) {
            els.eyebrow.textContent =
                step.id === 'review' ? 'Último passo' : `Passo ${stepIndex + 1} de ${STEPS.length}`;
        }
        if (els.title) els.title.textContent = step.title;
        if (els.lead) els.lead.textContent = step.lead;
    };

    const optionCardHtml = (item, stepId, selected) => {
        const variant = resolveVariant(item, 'unidade');
        const img = ctx.catalog.productImageUrl(variant?.image || item.product.image) || '';
        const label = itemLabel(item, stepId);
        const price = ctx.formatPrice(itemPrice(item));
        const itemKey = item.group?.key || item.product.id;
        return `<button type="button" class="totem-dose-wizard__option${selected ? ' totem-dose-wizard__option--selected' : ''}" data-item-key="${ctx.esc(itemKey)}" role="listitem" aria-pressed="${selected ? 'true' : 'false'}">
<div class="totem-dose-wizard__option-media">${img ? `<img src="${ctx.esc(img)}" alt="" loading="lazy" decoding="async">` : '<span class="material-symbols-outlined" aria-hidden="true">liquor</span>'}</div>
<div class="totem-dose-wizard__option-copy">
<strong class="totem-dose-wizard__option-name">${ctx.esc(label)}</strong>
<span class="totem-dose-wizard__option-price">${price}</span>
</div>
<span class="material-symbols-outlined totem-dose-wizard__option-check" aria-hidden="true">check_circle</span>
</button>`;
    };

    const findItemByKey = (itemKey) => {
        const items = ctx.getDisplayItems?.() || [];
        return items.find((item) => (item.group?.key || item.product.id) === itemKey) || null;
    };

    const renderPicker = () => {
        const step = currentStep();
        const filter = stepFilters[step.id];
        const items = filter ? filter(ctx.getDisplayItems?.() || []) : [];
        if (els.picker) els.picker.hidden = false;
        if (els.review) els.review.hidden = true;
        if (!items.length) {
            if (els.options) els.options.innerHTML = '';
            if (els.empty) {
                els.empty.hidden = false;
                if (els.emptyLead) {
                    els.emptyLead.textContent = `Não encontramos opções de ${step.title.toLowerCase()} no catálogo.`;
                }
            }
            return;
        }
        if (els.empty) els.empty.hidden = true;
        const selected = selections[step.id];
        const selectedKey = selected ? selected.group?.key || selected.product.id : '';
        if (els.options) {
            els.options.innerHTML = items
                .map((item) => {
                    const key = item.group?.key || item.product.id;
                    return optionCardHtml(item, step.id, key === selectedKey);
                })
                .join('');
        }
    };

    const reviewRowHtml = (stepId, item) => {
        const step = STEPS.find((entry) => entry.id === stepId);
        const variant = resolveVariant(item, 'unidade');
        const img = ctx.catalog.productImageUrl(variant?.image || item.product.image) || '';
        return `<li class="totem-dose-wizard__review-row">
<div class="totem-dose-wizard__review-main">
${img ? `<img class="totem-dose-wizard__review-thumb" src="${ctx.esc(img)}" alt="" loading="lazy">` : ''}
<div class="totem-dose-wizard__review-copy">
<span class="totem-dose-wizard__review-label">${ctx.esc(step?.label || stepId)}</span>
<strong class="totem-dose-wizard__review-value">${ctx.esc(itemLabel(item, stepId))}</strong>
<span class="totem-dose-wizard__review-price">${ctx.formatPrice(itemPrice(item))}</span>
</div>
</div>
<button type="button" class="totem-dose-wizard__edit" data-edit-step="${ctx.esc(stepId)}" aria-label="Editar ${ctx.esc(step?.label || stepId)}">
<span class="material-symbols-outlined" aria-hidden="true">edit</span>
</button>
</li>`;
    };

    const renderReview = () => {
        if (els.picker) els.picker.hidden = true;
        if (els.review) els.review.hidden = false;
        if (els.empty) els.empty.hidden = true;
        const rows = ['tamanho', 'gelo', 'dose', 'energetico']
            .map((stepId) => {
                const item = selections[stepId];
                return item ? reviewRowHtml(stepId, item) : '';
            })
            .join('');
        if (els.reviewList) els.reviewList.innerHTML = rows;
        const total = ['tamanho', 'gelo', 'dose', 'energetico'].reduce(
            (sum, stepId) => sum + (selections[stepId] ? itemPrice(selections[stepId]) : 0),
            0,
        );
        if (els.total) els.total.textContent = ctx.formatPrice(total);
        if (els.addBtn) {
            els.addBtn.disabled = !selections.tamanho || !selections.gelo || !selections.dose || !selections.energetico;
        }
        if (els.finishBtn) els.finishBtn.hidden = !addedToCart;
    };

    const render = () => {
        if (!ctx?.isEnabled?.()) return;
        renderProgress();
        renderHeader();
        addedToCart = false;
        if (els.finishBtn) els.finishBtn.hidden = true;
        if (currentStep().id === 'review') renderReview();
        else renderPicker();
    };

    const goToStep = (index) => {
        stepIndex = Math.max(0, Math.min(index, STEPS.length - 1));
        render();
        ctx?.bumpIdle?.();
    };

    const selectItem = (item) => {
        const step = currentStep();
        if (!item || step.id === 'review') return;
        selections[step.id] = item;
        if (stepIndex < STEPS.length - 1) {
            stepIndex += 1;
            render();
        }
        ctx?.bumpIdle?.();
    };

    const addBundleToCart = () => {
        if (!ctx?.addItem) return;
        const parts = ['tamanho', 'gelo', 'dose', 'energetico'];
        if (parts.some((key) => !selections[key])) return;
        for (const stepId of parts) {
            const item = selections[stepId];
            const { cartKey, itemKey, tier } = resolveAddPayload(item, 'unidade');
            ctx.addItem(cartKey, itemKey, { tier, _skipTapGuard: true });
        }
        addedToCart = true;
        if (els.finishBtn) els.finishBtn.hidden = false;
        if (els.addBtn) {
            els.addBtn.disabled = true;
            const label = els.addBtn.querySelector('span:last-child');
            if (label) label.textContent = 'Adicionado ao carrinho';
        }
        ctx?.bumpIdle?.();
    };

    const resetWizard = () => {
        stepIndex = 0;
        selections = { tamanho: null, gelo: null, dose: null, energetico: null };
        addedToCart = false;
        if (els.addBtn) {
            els.addBtn.disabled = false;
            const label = els.addBtn.querySelector('span:last-child');
            if (label) label.textContent = 'Adicionar ao carrinho';
        }
    };

    const open = () => {
        if (!ctx?.isEnabled?.()) return;
        resetWizard();
        ctx.onOpen?.();
        ctx.setView?.('doseWizard');
        render();
    };

    const close = () => {
        resetWizard();
        ctx.onClose?.();
    };

    const bindEvents = () => {
        els.back?.addEventListener('click', () => close());
        els.options?.addEventListener('click', (event) => {
            const btn = event.target.closest('.totem-dose-wizard__option');
            if (!btn) return;
            const item = findItemByKey(btn.dataset.itemKey);
            selectItem(item);
        });
        els.reviewList?.addEventListener('click', (event) => {
            const editBtn = event.target.closest('[data-edit-step]');
            if (!editBtn) return;
            const stepId = editBtn.dataset.editStep;
            const index = STEPS.findIndex((step) => step.id === stepId);
            if (index >= 0) goToStep(index);
        });
        els.addBtn?.addEventListener('click', () => addBundleToCart());
        els.finishBtn?.addEventListener('click', () => {
            ctx.startCheckout?.();
        });
    };

    const init = (options = {}) => {
        ctx = options;
        els.view = document.getElementById('totem-view-dose-wizard');
        els.back = document.getElementById('totem-dose-back');
        els.progress = document.getElementById('totem-dose-progress');
        els.eyebrow = document.getElementById('totem-dose-eyebrow');
        els.title = document.getElementById('totem-dose-title');
        els.lead = document.getElementById('totem-dose-lead');
        els.picker = document.getElementById('totem-dose-step-picker');
        els.options = document.getElementById('totem-dose-options');
        els.review = document.getElementById('totem-dose-step-review');
        els.reviewList = document.getElementById('totem-dose-review-list');
        els.total = document.getElementById('totem-dose-total');
        els.addBtn = document.getElementById('totem-dose-add-btn');
        els.finishBtn = document.getElementById('totem-dose-finish-btn');
        els.empty = document.getElementById('totem-dose-empty');
        els.emptyLead = document.getElementById('totem-dose-empty-lead');
        bindEvents();
    };

    window.LigeirinhoTotemDoseWizard = { init, open, close, render, isEnabled: () => Boolean(ctx?.isEnabled?.()) };
})();
