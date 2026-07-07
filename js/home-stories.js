(function () {
    const SEEN_KEY = 'ligeirinho-home-stories-seen';
    const SLIDE_MS = 5500;

    const esc = (v) =>
        String(v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');

    const loadSeen = () => {
        try {
            const raw = localStorage.getItem(SEEN_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    };

    const saveSeen = (ids) => {
        try {
            localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
        } catch {
            /* ignore */
        }
    };

    const markSeen = (id) => {
        const seen = loadSeen();
        if (!seen.includes(id)) {
            seen.push(id);
            saveSeen(seen);
        }
    };

    const resolveThumb = (story, catalog, catalogData, eager = false) => {
        const loading = eager ? 'eager' : 'lazy';
        const fetchPriority = eager ? ' fetchpriority="high"' : '';
        if (story.thumbImage) {
            return `<img alt="" class="home-promo-story__img" src="${esc(story.thumbImage)}" loading="${loading}" decoding="async"${fetchPriority}>`;
        }
        if (story.thumbCategory && catalog && catalogData) {
            const cat =
                catalog.resolveCatalogCategory(catalogData, story.thumbCategory) ||
                catalogData.categories?.find((c) => c.id === story.thumbCategory);
            if (cat) {
                const cover = catalog.categoryCoverMedia(cat, catalogData.categories || []);
                if (cover.type === 'img') {
                    return `<img alt="" class="home-promo-story__img" src="${esc(cover.src)}" loading="lazy" decoding="async">`;
                }
            }
        }
        const icon = story.thumbIcon || 'local_offer';
        return `<span class="material-symbols-outlined home-promo-story__icon" aria-hidden="true">${esc(icon)}</span>`;
    };

    const resolveSlideImage = (slide, catalog, catalogData) => {
        const catId = slide.imageCategory || slide.thumbCategory;
        if (!catId || !catalog || !catalogData) return '';
        const cat =
            catalog.resolveCatalogCategory(catalogData, catId) ||
            catalogData.categories?.find((c) => c.id === catId);
        if (!cat) return '';
        const cover = catalog.categoryCoverMedia(cat, catalogData.categories || []);
        return cover.type === 'img' ? cover.src : '';
    };

    const storyRailHtml = (stories, catalog, catalogData) => {
        const seen = loadSeen();
        if (!stories.length) return '';

        const items = stories
            .map((story, index) => {
                const isSeen = seen.includes(story.id);
                const ringColor = story.ringColor || '#F7D53C';
                const thumb = resolveThumb(story, catalog, catalogData, index < 4);
                return `<button type="button" class="home-promo-story${isSeen ? ' home-promo-story--seen' : ''}" data-story-index="${index}" data-story-id="${esc(story.id)}" style="--home-promo-ring:${esc(ringColor)}" aria-label="${esc(story.label)} — promoção">
<span class="home-promo-story__ring">${thumb}</span>
<span class="home-promo-story__label">${esc(story.label)}</span>
</button>`;
            })
            .join('');

        return `<div class="home-promo-stories" aria-label="Promoções">${items}</div>`;
    };

    let viewerState = null;

    const closeViewer = () => {
        if (!viewerState) return;
        clearTimeout(viewerState.timer);
        if (viewerState.onKey) document.removeEventListener('keydown', viewerState.onKey);
        viewerState.overlay?.remove();
        document.documentElement.classList.remove('lig-story-open');
        const onClose = viewerState.onClose;
        viewerState = null;
        onClose?.();
    };

    const renderSlide = () => {
        if (!viewerState) return;
        const { story, slideIndex, catalog, catalogData } = viewerState;
        const slides = story.slides || [];
        const slide = slides[slideIndex];
        if (!slide) {
            closeViewer();
            return;
        }

        const imgSrc = slide.imageFull || slide.image || resolveSlideImage(slide, catalog, catalogData);
        const theme = slide.theme || 'yellow';
        const isPhotoPromo = Boolean(imgSrc && theme === 'photo');
        const progress = slides
            .map((_, i) => {
                let cls = 'lig-story-viewer__bar';
                if (i < slideIndex) cls += ' lig-story-viewer__bar--done';
                else if (i === slideIndex) cls += ' lig-story-viewer__bar--active';
                return `<span class="${cls}"><span class="lig-story-viewer__bar-fill"></span></span>`;
            })
            .join('');

        const body = viewerState.overlay.querySelector('.lig-story-viewer__body');
        if (!body) return;

        body.className = `lig-story-viewer__body lig-story-viewer__body--${esc(theme)}`;
        body.innerHTML = `${
            imgSrc
                ? `<img class="lig-story-viewer__bg" src="${esc(imgSrc)}" alt="" decoding="async">`
                : ''
        }<div class="lig-story-viewer__shade"></div>
<div class="lig-story-viewer__content${isPhotoPromo ? ' lig-story-viewer__content--photo' : ''}">
${slide.kicker ? `<p class="lig-story-viewer__kicker">${esc(slide.kicker)}</p>` : ''}
${slide.title ? `<h2 class="lig-story-viewer__title">${esc(slide.title)}</h2>` : ''}
${!slide.title && !isPhotoPromo ? `<h2 class="lig-story-viewer__title">${esc(story.label)}</h2>` : ''}
${slide.body ? `<p class="lig-story-viewer__text">${esc(slide.body)}</p>` : ''}
${
    slide.cta?.href
        ? `<a href="${esc(slide.cta.href)}" class="lig-story-viewer__cta${isPhotoPromo ? ' lig-story-viewer__cta--compact' : ''}">${esc(slide.cta.label || 'Saiba mais')}</a>`
        : ''
}
</div>`;

        const head = viewerState.overlay.querySelector('.lig-story-viewer__progress');
        if (head) head.innerHTML = progress;

        const activeBar = viewerState.overlay.querySelector('.lig-story-viewer__bar--active .lig-story-viewer__bar-fill');
        if (activeBar) {
            activeBar.style.animation = 'none';
            void activeBar.offsetWidth;
            activeBar.style.animation = '';
        }

        clearTimeout(viewerState.timer);
        viewerState.timer = setTimeout(() => goNext(true), SLIDE_MS);
    };

    const goNext = (auto = false) => {
        if (!viewerState) return;
        const slides = viewerState.story.slides || [];
        if (viewerState.slideIndex < slides.length - 1) {
            viewerState.slideIndex += 1;
            renderSlide();
            return;
        }
        markSeen(viewerState.story.id);
        const nextStoryIndex = viewerState.storyIndex + 1;
        const stories = viewerState.stories;
        if (auto && nextStoryIndex < stories.length) {
            viewerState.storyIndex = nextStoryIndex;
            viewerState.story = stories[nextStoryIndex];
            viewerState.slideIndex = 0;
            renderSlide();
            return;
        }
        closeViewer();
        viewerState?.onClose?.();
    };

    const goPrev = () => {
        if (!viewerState) return;
        if (viewerState.slideIndex > 0) {
            viewerState.slideIndex -= 1;
            renderSlide();
            return;
        }
        if (viewerState.storyIndex > 0) {
            const prev = viewerState.stories[viewerState.storyIndex - 1];
            viewerState.storyIndex -= 1;
            viewerState.story = prev;
            viewerState.slideIndex = Math.max(0, (prev.slides?.length || 1) - 1);
            renderSlide();
        }
    };

    const openViewer = (stories, storyIndex, catalog, catalogData, onClose) => {
        closeViewer();
        const story = stories[storyIndex];
        if (!story?.slides?.length) return;

        const overlay = document.createElement('div');
        overlay.className = 'lig-story-viewer';
        overlay.innerHTML = `<div class="lig-story-viewer__shell" role="dialog" aria-modal="true" aria-label="${esc(story.label)}">
<div class="lig-story-viewer__top">
<div class="lig-story-viewer__progress"></div>
<div class="lig-story-viewer__meta">
<span class="lig-story-viewer__name">${esc(story.label)}</span>
<button type="button" class="lig-story-viewer__close" aria-label="Fechar"><span class="material-symbols-outlined">close</span></button>
</div>
</div>
<div class="lig-story-viewer__body"></div>
<button type="button" class="lig-story-viewer__tap lig-story-viewer__tap--prev" aria-label="Anterior"></button>
<button type="button" class="lig-story-viewer__tap lig-story-viewer__tap--next" aria-label="Próximo"></button>
</div>`;

        document.body.appendChild(overlay);
        document.documentElement.classList.add('lig-story-open');

        viewerState = {
            overlay,
            stories,
            storyIndex,
            story,
            slideIndex: 0,
            catalog,
            catalogData,
            onClose,
            timer: null,
            onKey: null,
        };

        overlay.querySelector('.lig-story-viewer__close')?.addEventListener('click', () => {
            markSeen(story.id);
            closeViewer();
        });
        overlay.querySelector('.lig-story-viewer__tap--next')?.addEventListener('click', () => goNext(false));
        overlay.querySelector('.lig-story-viewer__tap--prev')?.addEventListener('click', goPrev);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                markSeen(story.id);
                closeViewer();
            }
        });
        document.addEventListener(
            'keydown',
            (viewerState.onKey = (e) => {
                if (!viewerState) return;
                if (e.key === 'Escape') {
                    markSeen(story.id);
                    closeViewer();
                } else if (e.key === 'ArrowRight') goNext(false);
                else if (e.key === 'ArrowLeft') goPrev();
            })
        );

        renderSlide();
    };

    const bindRail = (root, stories, catalog, catalogData, onSeenChange) => {
        root.querySelectorAll('.home-promo-story').forEach((btn) => {
            btn.addEventListener('click', () => {
                const index = Number(btn.dataset.storyIndex);
                if (!Number.isFinite(index)) return;
                openViewer(stories, index, catalog, catalogData, () => {
                    onSeenChange?.();
                });
            });
        });
    };

    const loadConfig = () => Promise.resolve({ stories: [], source: 'disabled:marketing-drive' });

    window.LigeirinhoHomeStories = {
        loadConfig,
        storyRailHtml,
        bindRail,
        markSeen,
        loadSeen,
    };
})();
