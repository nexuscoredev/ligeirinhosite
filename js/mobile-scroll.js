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
    const MOBILE = window.matchMedia('(max-width: 767px)');

    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let axis = null;
    let activeEl = null;
    let pointerId = null;

    const isCoarse = () => COARSE.matches;

    const getScrollRoot = () => {
        if (MOBILE.matches && document.documentElement.classList.contains('lig-app-mode')) {
            const main = document.getElementById('lig-page-main');
            if (main) {
                const style = window.getComputedStyle(main);
                if (style.overflowY === 'auto' || style.overflowY === 'scroll') return main;
                const nested = main.querySelector('.conta-page');
                if (nested) {
                    const ns = window.getComputedStyle(nested);
                    if (ns.overflowY === 'auto' || ns.overflowY === 'scroll') return nested;
                }
                return main;
            }
        }
        return document.scrollingElement || document.documentElement;
    };

    const getY = () => {
        const root = getScrollRoot();
        if (root === document.body || root === document.documentElement) {
            return window.scrollY || root.scrollTop || 0;
        }
        return root.scrollTop || 0;
    };

    const setY = (y) => {
        const root = getScrollRoot();
        const top = Math.max(0, Number(y) || 0);
        if (root === document.body || root === document.documentElement) {
            window.scrollTo(0, top);
        } else {
            root.scrollTop = top;
        }
    };

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
    };

    const onPointerUp = (e) => {
        if (e.pointerId !== pointerId) return;
        reset();
    };

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
        getScrollRoot,
        getY,
        setY,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
