/**
 * Scroll mobile: prioriza rolagem vertical da página.
 * Carrosséis horizontais só capturam o gesto quando o eixo X é claramente dominante.
 */
(function () {
    const SELECTOR = [
        '.parceiros-product-scroll',
        '.home-suggested-scroll',
        '.ze-product-scroll',
        '.home-quick-chips',
        '.home-stories-scroll',
        '.ze-filter-pills',
        '.ze-reorder-scroll',
        '.lig-hscroll',
    ].join(',');

    const THRESHOLD = 8;
    const LOCK_RATIO = 1.15;
    const COARSE = window.matchMedia('(hover: none), (pointer: coarse)');

    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let axis = null;
    let activeEl = null;
    let pointerId = null;

    const isCoarse = () => COARSE.matches;

    const reset = () => {
        if (activeEl) activeEl.classList.remove('lig-hscroll--dragging');
        activeEl = null;
        axis = null;
        pointerId = null;
    };

    const onPointerDown = (e) => {
        if (!isCoarse()) return;
        if (e.pointerType === 'mouse') return;
        const el = e.target?.closest?.(SELECTOR);
        if (!el || el.scrollWidth <= el.clientWidth + 1) return;

        activeEl = el;
        axis = null;
        pointerId = e.pointerId;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = el.scrollLeft;
    };

    const onPointerMove = (e) => {
        if (!activeEl || e.pointerId !== pointerId) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (!axis) {
            if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return;
            /* Prefere vertical: só trava no X se for claramente dominante. */
            axis = Math.abs(dx) > Math.abs(dy) * LOCK_RATIO ? 'x' : 'y';
            if (axis === 'x') {
                activeEl.classList.add('lig-hscroll--dragging');
                try {
                    activeEl.setPointerCapture(e.pointerId);
                } catch (_) {
                    /* ignore */
                }
            }
        }

        if (axis === 'x') {
            activeEl.scrollLeft = startLeft - dx;
            if (e.cancelable) e.preventDefault();
        }
        /* axis === 'y': não interfere — touch-action:pan-y deixa a página rolar. */
    };

    const onPointerUp = (e) => {
        if (e.pointerId !== pointerId) return;
        reset();
    };

    /** Fallback iOS antigo / WebViews sem Pointer Events confiáveis */
    let touchEl = null;
    let touchAxis = null;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartLeft = 0;

    const onTouchStart = (e) => {
        if (!isCoarse() || window.PointerEvent) return;
        const el = e.target?.closest?.(SELECTOR);
        if (!el || el.scrollWidth <= el.clientWidth + 1) return;
        const t = e.touches[0];
        if (!t) return;
        touchEl = el;
        touchAxis = null;
        touchStartX = t.clientX;
        touchStartY = t.clientY;
        touchStartLeft = el.scrollLeft;
    };

    const onTouchMove = (e) => {
        if (!touchEl || !e.touches[0]) return;
        const t = e.touches[0];
        const dx = t.clientX - touchStartX;
        const dy = t.clientY - touchStartY;

        if (!touchAxis) {
            if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return;
            touchAxis = Math.abs(dx) > Math.abs(dy) * LOCK_RATIO ? 'x' : 'y';
            if (touchAxis === 'y') {
                touchEl = null;
                return;
            }
            touchEl.classList.add('lig-hscroll--dragging');
        }

        if (touchAxis === 'x') {
            touchEl.scrollLeft = touchStartLeft - dx;
            if (e.cancelable) e.preventDefault();
        }
    };

    const onTouchEnd = () => {
        touchEl?.classList.remove('lig-hscroll--dragging');
        touchEl = null;
        touchAxis = null;
    };

    const decorate = (root) => {
        (root || document).querySelectorAll(SELECTOR).forEach((el) => {
            el.classList.add('lig-hscroll');
        });
    };

    const init = () => {
        decorate(document);
        document.addEventListener('pointerdown', onPointerDown, { passive: true, capture: true });
        document.addEventListener('pointermove', onPointerMove, { passive: false, capture: true });
        document.addEventListener('pointerup', onPointerUp, { passive: true, capture: true });
        document.addEventListener('pointercancel', onPointerUp, { passive: true, capture: true });

        document.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
        document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
        document.addEventListener('touchend', onTouchEnd, { passive: true, capture: true });
        document.addEventListener('touchcancel', onTouchEnd, { passive: true, capture: true });

        const main = document.getElementById('lig-page-main') || document.body;
        if (typeof MutationObserver !== 'undefined' && main) {
            let timer = 0;
            const mo = new MutationObserver(() => {
                window.clearTimeout(timer);
                timer = window.setTimeout(() => decorate(main), 80);
            });
            mo.observe(main, { childList: true, subtree: true });
        }
    };

    window.LigeirinhoMobileScroll = {
        refresh: () => decorate(document),
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
