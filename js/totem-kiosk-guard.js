/**
 * Proteções do totem no navegador (complementa totem-kiosk.bat + lockdown do Windows).
 * Não bloqueia atalhos do sistema (Win, Alt+Tab, gestos de borda) — use scripts/totem-windows-lockdown.ps1.
 */
(function () {
    'use strict';

    const root = document.documentElement;
    if (!root.classList.contains('totem-kiosk')) return;

    const TOTEM_PAGE_RE = /totem(?:-[a-z]+)?\.html/i;

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

        wrap.querySelectorAll('.totem-kiosk-edge-shield').forEach((el) => {
            const stop = (e) => {
                e.preventDefault();
                e.stopPropagation();
            };
            el.addEventListener('pointerdown', stop, { passive: false });
            el.addEventListener('touchstart', stop, { passive: false });
            el.addEventListener('touchmove', stop, { passive: false });
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
