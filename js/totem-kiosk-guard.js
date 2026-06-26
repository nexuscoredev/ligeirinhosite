/**
 * Proteções do totem no navegador (complementa totem-kiosk.bat + lockdown do Windows).
 * Gestos de borda (Task View / Win+Tab) exigem também scripts/totem-windows-lockdown.ps1 no PC.
 */
(function () {
    'use strict';

    const root = document.documentElement;
    if (!root.classList.contains('totem-kiosk')) return;

    const TOTEM_PAGE_RE = /totem(?:-[a-z]+)?\.html/i;
    const EDGE_ZONE = 56;
    const CAPTURE_OPTS = { capture: true, passive: false };

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

    const isNearEdge = (x, y) => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        return x <= EDGE_ZONE || x >= w - EDGE_ZONE || y <= EDGE_ZONE || y >= h - EDGE_ZONE;
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

    const bindEdgeGestureGuard = () => {
        const edgePointers = new Set();
        const edgeTouches = new Set();

        const onPointerDown = (e) => {
            if (e.pointerType === 'mouse') return;
            if (!isNearEdge(e.clientX, e.clientY)) return;
            edgePointers.add(e.pointerId);
            stopEdgeEvent(e);
        };

        const onPointerMove = (e) => {
            if (!edgePointers.has(e.pointerId)) return;
            stopEdgeEvent(e);
        };

        const onPointerEnd = (e) => {
            edgePointers.delete(e.pointerId);
        };

        window.addEventListener('pointerdown', onPointerDown, CAPTURE_OPTS);
        window.addEventListener('pointermove', onPointerMove, CAPTURE_OPTS);
        window.addEventListener('pointerup', onPointerEnd, CAPTURE_OPTS);
        window.addEventListener('pointercancel', onPointerEnd, CAPTURE_OPTS);

        const onTouchStart = (e) => {
            let hit = false;
            for (const touch of e.changedTouches) {
                if (isNearEdge(touch.clientX, touch.clientY)) {
                    edgeTouches.add(touch.identifier);
                    hit = true;
                }
            }
            if (hit) stopEdgeEvent(e);
        };

        const onTouchMove = (e) => {
            for (const touch of e.changedTouches) {
                if (edgeTouches.has(touch.identifier)) {
                    stopEdgeEvent(e);
                    return;
                }
            }
        };

        const onTouchEnd = (e) => {
            for (const touch of e.changedTouches) {
                edgeTouches.delete(touch.identifier);
            }
        };

        window.addEventListener('touchstart', onTouchStart, CAPTURE_OPTS);
        window.addEventListener('touchmove', onTouchMove, CAPTURE_OPTS);
        window.addEventListener('touchend', onTouchEnd, CAPTURE_OPTS);
        window.addEventListener('touchcancel', onTouchEnd, CAPTURE_OPTS);
    };

    const mountEdgeShields = () => {
        if (document.getElementById('totem-kiosk-shields')) return;
        const host = document.body || document.documentElement;
        const wrap = document.createElement('div');
        wrap.id = 'totem-kiosk-shields';
        wrap.setAttribute('aria-hidden', 'true');
        wrap.innerHTML = `
<div class="totem-kiosk-edge-shield totem-kiosk-edge-shield--left"></div>
<div class="totem-kiosk-edge-shield totem-kiosk-edge-shield--right"></div>
<div class="totem-kiosk-edge-shield totem-kiosk-edge-shield--top"></div>
<div class="totem-kiosk-edge-shield totem-kiosk-edge-shield--corner"></div>`;
        host.appendChild(wrap);

        const shieldEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'touchstart', 'touchmove', 'touchend', 'touchcancel'];
        wrap.querySelectorAll('.totem-kiosk-edge-shield').forEach((el) => {
            shieldEvents.forEach((type) => {
                el.addEventListener(type, stopEdgeEvent, { passive: false });
            });
        });
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
        mountEdgeShields();
        bindEdgeGestureGuard();
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
