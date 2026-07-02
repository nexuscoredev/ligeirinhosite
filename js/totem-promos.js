(function () {
    let deps = null;
    let bound = false;
    let mktImages = [];
    let fetchError = false;
    let slideIndex = 0;
    let autoTimer = null;
    let touchStartX = 0;

    const AUTO_MS = 7000;
    const mkt = () => window.LigeirinhoMktPromos;

    const esc = (value) =>
        String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');

    const loadImages = async (force = false) => {
        const api = mkt();
        if (!api?.loadMarketingStories) {
            fetchError = true;
            mktImages = [];
            return mktImages;
        }
        try {
            const data = await api.loadMarketingStories({ force });
            mktImages = api.collectImageUrls(data.stories);
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

    const buildDotsHtml = (images, active) =>
        images
            .map(
                (_, index) =>
                    `<button type="button" class="totem-promos__dot${index === active ? ' totem-promos__dot--active' : ''}" data-mkt-dot="${index}" aria-label="Promoção ${index + 1}" ${index === active ? 'aria-current="true"' : ''}></button>`
            )
            .join('');

    const buildCarouselHtml = (images) => `<div class="totem-promos__carousel" data-totem-promos-carousel>
<div class="totem-promos__stage" data-totem-promos-stage>
<button type="button" class="totem-promos__nav totem-promos__nav--prev" data-mkt-prev aria-label="Promoção anterior">
<span class="material-symbols-outlined" aria-hidden="true">chevron_left</span>
</button>
<div class="totem-promos__frame">
<img class="totem-promos__slide-img" data-mkt-slide-img src="${esc(images[0])}" alt="" decoding="async" fetchpriority="high">
</div>
<button type="button" class="totem-promos__nav totem-promos__nav--next" data-mkt-next aria-label="Próxima promoção">
<span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>
</button>
</div>
<footer class="totem-promos__footer">
<p class="totem-promos__counter" data-mkt-counter>1 / ${images.length}</p>
<div class="totem-promos__dots" data-mkt-dots role="tablist" aria-label="Promoções">
${buildDotsHtml(images, 0)}
</div>
</footer>
</div>`;

    const getCarouselEl = () => deps?.gridEl?.querySelector('[data-totem-promos-carousel]');

    const prefetchNeighbors = (index) => {
        const api = mkt();
        if (!api || mktImages.length < 2) return;
        const next = mktImages[(index + 1) % mktImages.length];
        const prev = mktImages[(index - 1 + mktImages.length) % mktImages.length];
        void api.preloadImage(next);
        void api.preloadImage(prev);
    };

    const updateSlide = () => {
        const root = getCarouselEl();
        if (!root || !mktImages.length) return;

        const index = ((slideIndex % mktImages.length) + mktImages.length) % mktImages.length;
        slideIndex = index;

        const img = root.querySelector('[data-mkt-slide-img]');
        const counter = root.querySelector('[data-mkt-counter]');
        const dots = root.querySelector('[data-mkt-dots]');
        const prev = root.querySelector('[data-mkt-prev]');
        const next = root.querySelector('[data-mkt-next]');

        if (img) img.src = mktImages[index];
        if (counter) counter.textContent = `${index + 1} / ${mktImages.length}`;
        if (dots) dots.innerHTML = buildDotsHtml(mktImages, index);
        if (prev) prev.disabled = mktImages.length <= 1;
        if (next) next.disabled = mktImages.length <= 1;
        prefetchNeighbors(index);
    };

    const goToSlide = (index) => {
        if (!mktImages.length) return;
        slideIndex = index;
        updateSlide();
        deps?.onBumpIdle?.();
        restartAuto();
    };

    const stepSlide = (delta) => {
        if (!mktImages.length) return;
        goToSlide(slideIndex + delta);
    };

    const stopAuto = () => {
        if (autoTimer) {
            clearInterval(autoTimer);
            autoTimer = null;
        }
    };

    const startAuto = () => {
        stopAuto();
        if (mktImages.length <= 1) return;
        autoTimer = window.setInterval(() => stepSlide(1), AUTO_MS);
    };

    const restartAuto = () => {
        stopAuto();
        startAuto();
    };

    const bindCarousel = () => {
        const root = getCarouselEl();
        if (!root || root.dataset.bound === '1') return;
        root.dataset.bound = '1';

        root.addEventListener('click', (e) => {
            if (e.target.closest('[data-mkt-prev]')) stepSlide(-1);
            if (e.target.closest('[data-mkt-next]')) stepSlide(1);
            const dot = e.target.closest('[data-mkt-dot]');
            if (dot) goToSlide(Number(dot.dataset.mktDot));
        });

        const stage = root.querySelector('[data-totem-promos-stage]');
        stage?.addEventListener(
            'touchstart',
            (e) => {
                touchStartX = e.changedTouches?.[0]?.clientX || 0;
            },
            { passive: true }
        );
        stage?.addEventListener(
            'touchend',
            (e) => {
                const endX = e.changedTouches?.[0]?.clientX || 0;
                const delta = endX - touchStartX;
                if (Math.abs(delta) < 48) return;
                stepSlide(delta < 0 ? 1 : -1);
            },
            { passive: true }
        );
    };

    const render = async () => {
        if (!deps?.gridEl) return;
        stopAuto();
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

        const api = mkt();
        await api?.preloadImage?.(images[0]);

        slideIndex = 0;
        setPanelVisibility({ showGrid: true });
        deps.gridEl.innerHTML = buildCarouselHtml(images);
        deps.gridEl.classList.add('totem-promos__grid--carousel');
        bindCarousel();
        updateSlide();
        startAuto();
        void api?.preloadImages?.(images.slice(1), 2);
    };

    const bindGrid = () => {
        if (!deps?.gridEl || bound) return;
        bound = true;
        deps.retryBtn?.addEventListener('click', () => refresh());
    };

    const init = async (nextDeps) => {
        deps = nextDeps;
        bindGrid();
        await render();
    };

    const refresh = async () => {
        mkt()?.clearCache?.();
        mktImages = [];
        fetchError = false;
        await loadImages(true);
        await render();
    };

    const closeLightbox = () => stopAuto();

    window.LigeirinhoTotemPromos = { init, render, refresh, closeLightbox, stopAuto, startAuto };
})();
