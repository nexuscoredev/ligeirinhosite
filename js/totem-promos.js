(function () {
    let deps = null;
    let bound = false;
    let mktImages = [];
    let fetchError = false;
    let loadedAt = 0;
    let lightboxEl = null;
    let lightboxIndex = 0;

    const CACHE_MS = 60_000;

    const esc = (value) =>
        String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');

    const collectImages = (stories) => {
        const urls = [];
        (stories || []).forEach((story) => {
            (story.slides || []).forEach((slide) => {
                if (slide.image && !urls.includes(slide.image)) urls.push(slide.image);
            });
        });
        return urls;
    };

    const loadImages = async (force = false) => {
        const now = Date.now();
        if (!force && mktImages.length && now - loadedAt < CACHE_MS) {
            fetchError = false;
            return mktImages;
        }
        try {
            const res = await fetch('/api/marketing-stories', { cache: 'no-store' });
            if (!res.ok) throw new Error('fetch failed');
            const data = await res.json();
            mktImages = collectImages(data.stories);
            loadedAt = now;
            fetchError = false;
        } catch {
            fetchError = true;
            if (!mktImages.length) mktImages = [];
        }
        return mktImages;
    };

    const setPanelVisibility = ({ showLoading = false, showError = false, showGrid = false, showEmpty = false } = {}) => {
        const { loadingEl, errorEl, gridEl, emptyEl } = deps || {};
        if (loadingEl) {
            loadingEl.hidden = !showLoading;
            loadingEl.style.display = showLoading ? '' : 'none';
        }
        if (errorEl) {
            errorEl.hidden = !showError;
            errorEl.style.display = showError ? '' : 'none';
        }
        if (gridEl) {
            gridEl.hidden = !showGrid;
            gridEl.style.display = showGrid ? '' : 'none';
        }
        if (emptyEl) {
            emptyEl.hidden = !showEmpty;
            emptyEl.style.display = showEmpty ? '' : 'none';
        }
    };

    const buildGridHtml = (images) =>
        images
            .map(
                (url, index) => `<button type="button" class="totem-promos__mkt-item" data-mkt-index="${index}" aria-label="Ver promoção ${index + 1} de ${images.length}" style="--totem-promo-i:${Math.min(index, 16)}">
<figure class="totem-promos__mkt-figure">
<img src="${esc(url)}" alt="" class="totem-promos__mkt-img" loading="lazy" decoding="async">
</figure>
</button>`
            )
            .join('');

    const ensureLightbox = () => {
        if (lightboxEl) return lightboxEl;
        lightboxEl = document.createElement('div');
        lightboxEl.id = 'totem-promo-lightbox';
        lightboxEl.className = 'totem-promo-lightbox';
        lightboxEl.hidden = true;
        lightboxEl.setAttribute('aria-hidden', 'true');
        lightboxEl.innerHTML = `<div class="totem-promo-lightbox__backdrop" data-lightbox-close></div>
<div class="totem-promo-lightbox__sheet" role="dialog" aria-modal="true" aria-label="Promoção em tela cheia">
<button type="button" class="totem-promo-lightbox__close" data-lightbox-close aria-label="Fechar">
<span class="material-symbols-outlined" aria-hidden="true">close</span>
</button>
<button type="button" class="totem-promo-lightbox__nav totem-promo-lightbox__nav--prev" data-lightbox-prev aria-label="Promoção anterior">
<span class="material-symbols-outlined" aria-hidden="true">chevron_left</span>
</button>
<img class="totem-promo-lightbox__img" id="totem-promo-lightbox-img" alt="">
<button type="button" class="totem-promo-lightbox__nav totem-promo-lightbox__nav--next" data-lightbox-next aria-label="Próxima promoção">
<span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>
</button>
<p class="totem-promo-lightbox__counter" id="totem-promo-lightbox-counter"></p>
</div>`;
        document.body.appendChild(lightboxEl);

        lightboxEl.addEventListener('click', (e) => {
            if (e.target.closest('[data-lightbox-close]')) closeLightbox();
            if (e.target.closest('[data-lightbox-prev]')) stepLightbox(-1);
            if (e.target.closest('[data-lightbox-next]')) stepLightbox(1);
        });

        return lightboxEl;
    };

    const updateLightbox = () => {
        const img = lightboxEl?.querySelector('#totem-promo-lightbox-img');
        const counter = lightboxEl?.querySelector('#totem-promo-lightbox-counter');
        const url = mktImages[lightboxIndex];
        if (img) img.src = url || '';
        if (counter) counter.textContent = mktImages.length ? `${lightboxIndex + 1} / ${mktImages.length}` : '';
        lightboxEl?.querySelector('[data-lightbox-prev]')?.toggleAttribute('disabled', lightboxIndex <= 0);
        lightboxEl
            ?.querySelector('[data-lightbox-next]')
            ?.toggleAttribute('disabled', lightboxIndex >= mktImages.length - 1);
    };

    const openLightbox = (index) => {
        if (!mktImages.length) return;
        ensureLightbox();
        lightboxIndex = Math.max(0, Math.min(index, mktImages.length - 1));
        updateLightbox();
        lightboxEl.hidden = false;
        lightboxEl.setAttribute('aria-hidden', 'false');
        lightboxEl.classList.add('totem-promo-lightbox--open');
        deps?.onBumpIdle?.();
    };

    const closeLightbox = () => {
        if (!lightboxEl) return;
        lightboxEl.classList.remove('totem-promo-lightbox--open');
        lightboxEl.hidden = true;
        lightboxEl.setAttribute('aria-hidden', 'true');
        deps?.onBumpIdle?.();
    };

    const stepLightbox = (delta) => {
        const next = lightboxIndex + delta;
        if (next < 0 || next >= mktImages.length) return;
        lightboxIndex = next;
        updateLightbox();
        deps?.onBumpIdle?.();
    };

    const render = async () => {
        if (!deps?.gridEl) return;
        setPanelVisibility({ showLoading: true });
        const images = await loadImages();
        if (fetchError && !images.length) {
            setPanelVisibility({ showError: true });
            return;
        }
        if (!images.length) {
            setPanelVisibility({ showEmpty: true });
            return;
        }
        setPanelVisibility({ showGrid: true });
        deps.gridEl.innerHTML = buildGridHtml(images);
        deps.gridEl.classList.add('totem-promos__grid--mkt');
    };

    const bindGrid = () => {
        if (!deps?.gridEl || bound) return;
        bound = true;
        deps.gridEl.addEventListener('click', (e) => {
            const item = e.target.closest('.totem-promos__mkt-item');
            if (!item) return;
            const index = Number(item.dataset.mktIndex);
            if (!Number.isFinite(index)) return;
            openLightbox(index);
        });
        deps.retryBtn?.addEventListener('click', () => refresh());
    };

    const init = async (nextDeps) => {
        deps = nextDeps;
        bindGrid();
        await render();
    };

    const refresh = async () => {
        mktImages = [];
        loadedAt = 0;
        fetchError = false;
        await loadImages(true);
        await render();
    };

    window.LigeirinhoTotemPromos = { init, render, refresh, closeLightbox };
})();
