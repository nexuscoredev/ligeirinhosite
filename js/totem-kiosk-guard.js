/**
 * Proteções do totem no navegador (complementa totem-kiosk.bat + lockdown do Windows).
 * Gestos de borda (Task View) exigem também scripts/totem-windows-lockdown.ps1 no PC.
 */
(function () {
    'use strict';

    const root = document.documentElement;
    if (!root.classList.contains('totem-kiosk')) return;

    const TOTEM_PAGE_RE = /totem(?:-[a-z]+)?\.html/i;
    /** Faixa estreita na borda esquerda — bloqueio imediato antes do Windows capturar o gesto. */
    const LEFT_HARD_EDGE = 10;
    /** Zona onde só bloqueamos deslize horizontal para a direita (Task View). */
    const LEFT_SOFT_EDGE = 28;
    const SWIPE_MIN_DX = 36;
    const CAPTURE_OPTS = { capture: true, passive: false };
    const INTERACTIVE_SEL = [
        'button',
        'a',
        'input',
        'textarea',
        'select',
        'label',
        '[role="button"]',
        '[role="link"]',
        '[role="tab"]',
        '.totem-btn',
        '.totem-product',
        '.totem-vk',
        '.totem-vk__key',
        '.totem-float-cart',
        '.totem-cart-sheet',
        '.totem-detail',
        '.totem-categories-modal',
        '.totem-search',
        '.totem-customer__form',
        '.lig-payment-card',
        '.ze-filter-pill',
        '.totem-categories-btn',
    ].join(', ');

    const isInteractiveTarget = (e) => {
        const t = e.target;
        return t instanceof Element && Boolean(t.closest(INTERACTIVE_SEL));
    };

    const isAllowedNav = (href) => {
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return true;
        if (href.startsWith('//')) return false;
        try {
            const url = new URL(href, window.location.href);
            if (url.origin !== window.location.origin) return false;
            return TOTEM_PAGE_RE.test(url.pathname) || url.pathname === '/' || url.pathname.endsWith('/index.html');
        } catch {
            return TOTEM_PAGE_RE.test(href);
        }
    };

    const stopEdgeEvent = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    };

    const blockKey = (e) => {
        const key = String(e.key || '').toLowerCase();
        const code = String(e.code || '');
        const withMod = e.ctrlKey || e.metaKey || e.altKey;

        if (e.key === 'Escape') return;

        const blocked =
            key === 'f11' ||
            key === 'f12' ||
            key === 'f5' ||
            code === 'F1' ||
            (e.ctrlKey && (key === 'r' || key === 'w' || key === 'n' || key === 't' || key === 'p' || key === 'u')) ||
            (e.ctrlKey && e.shiftKey && (key === 'i' || key === 'j' || key === 'c' || key === 'delete')) ||
            (e.altKey && (key === 'f4' || key === 'home' || key === 'arrowleft' || key === 'tab')) ||
            (e.metaKey && withMod) ||
            key === 'browserback' ||
            key === 'browserforward' ||
            key === 'browserhome';

        if (!blocked) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    };

    /**
     * Bloqueia só o gesto Task View (borda esquerda → direita).
     * Não usa barreiras de tela nem bloqueia laterais/direita/topo — evita quebrar cliques no fluxo.
     */
    const bindLeftEdgeSwipeGuard = () => {
        /** @type {Map<number, { x: number, y: number, hard: boolean, block: boolean }>} */
        const sessions = new Map();

        const isLeftEdgeStart = (x) => x <= LEFT_SOFT_EDGE;

        const isTaskViewSwipe = (start, x, y) => {
            const dx = x - start.x;
            const dy = Math.abs(y - start.y);
            return dx >= SWIPE_MIN_DX && dx > dy * 1.15;
        };

        const onPointerDown = (e) => {
            if (e.pointerType === 'mouse') return;
            if (isInteractiveTarget(e)) return;
            if (!isLeftEdgeStart(e.clientX)) return;

            const hard = e.clientX <= LEFT_HARD_EDGE;
            sessions.set(e.pointerId, {
                x: e.clientX,
                y: e.clientY,
                hard,
                block: hard,
            });

            if (hard) stopEdgeEvent(e);
        };

        const onPointerMove = (e) => {
            const session = sessions.get(e.pointerId);
            if (!session || session.block) {
                if (session?.block) stopEdgeEvent(e);
                return;
            }
            if (isTaskViewSwipe(session, e.clientX, e.clientY)) {
                session.block = true;
                stopEdgeEvent(e);
            }
        };

        const onPointerEnd = (e) => {
            sessions.delete(e.pointerId);
        };

        window.addEventListener('pointerdown', onPointerDown, CAPTURE_OPTS);
        window.addEventListener('pointermove', onPointerMove, CAPTURE_OPTS);
        window.addEventListener('pointerup', onPointerEnd, CAPTURE_OPTS);
        window.addEventListener('pointercancel', onPointerEnd, CAPTURE_OPTS);
    };

    let wakeLock = null;
    let lockOverlay = null;

    const mountLockOverlay = () => {
        if (document.getElementById('totem-kiosk-lock')) return;
        lockOverlay = document.createElement('div');
        lockOverlay.id = 'totem-kiosk-lock';
        lockOverlay.className = 'totem-kiosk-lock';
        lockOverlay.hidden = true;
        lockOverlay.innerHTML =
            '<button type="button" class="totem-kiosk-lock__btn">' +
            '<span class="material-symbols-outlined" aria-hidden="true">lock</span>' +
            '<span>Toque para voltar ao totem</span>' +
            '</button>';
        document.body.appendChild(lockOverlay);
        lockOverlay.querySelector('button')?.addEventListener('click', () => {
            tryFullscreen();
        });
    };

    const showLock = () => {
        if (!lockOverlay) return;
        lockOverlay.hidden = false;
        lockOverlay.classList.add('totem-kiosk-lock--visible');
    };

    const hideLock = () => {
        if (!lockOverlay) return;
        lockOverlay.hidden = true;
        lockOverlay.classList.remove('totem-kiosk-lock--visible');
    };

    const requestWakeLock = async () => {
        if (!navigator.wakeLock?.request) return;
        try {
            wakeLock?.release?.();
            wakeLock = await navigator.wakeLock.request('screen');
        } catch {
            /* policy do kiosk */
        }
    };

    const tryFullscreen = async () => {
        const el = document.documentElement;
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (document.fullscreenEnabled && !document.fullscreenElement && req) {
            try {
                await req.call(el, { navigationUI: 'hide' });
            } catch {
                /* kiosk Chrome já está em tela cheia */
            }
        }
        await requestWakeLock();
        hideLock();
        window.focus();
    };

    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    document.addEventListener('keydown', blockKey, true);

    document.addEventListener(
        'click',
        (e) => {
            const a = e.target.closest('a[href]');
            if (!a) return;
            const href = a.getAttribute('href') || '';
            if (isAllowedNav(href)) return;
            e.preventDefault();
            e.stopPropagation();
        },
        true
    );

    document.addEventListener(
        'auxclick',
        (e) => {
            if (e.button === 1) e.preventDefault();
        },
        true
    );

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            tryFullscreen();
            return;
        }
        showLock();
    });

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) showLock();
    });

    window.addEventListener('blur', () => {
        window.setTimeout(() => {
            if (!document.hasFocus() || document.visibilityState === 'hidden') showLock();
        }, 250);
    });

    window.addEventListener('focus', tryFullscreen);

    document.addEventListener('totem-admin-open', () => {
        if (lockOverlay) lockOverlay.hidden = true;
    });

    document.addEventListener('totem-admin-close', () => {
        tryFullscreen();
    });

    const boot = () => {
        bindLeftEdgeSwipeGuard();
        mountLockOverlay();
        tryFullscreen();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }

    document.addEventListener(
        'pointerdown',
        () => {
            tryFullscreen();
        },
        { once: true, passive: true }
    );
})();
