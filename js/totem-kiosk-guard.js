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
            (e.altKey && (key === 'f4' || key === 'home' || key === 'arrowleft')) ||
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
        });
    };

    const tryFullscreen = () => {
        if (!document.fullscreenEnabled || document.fullscreenElement) return;
        const el = document.documentElement;
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (!req) return;
        try {
            const p = req.call(el);
            if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch {
            /* kiosk Chrome já está em tela cheia */
        }
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
        if (document.visibilityState === 'visible') tryFullscreen();
    });

    window.addEventListener('focus', tryFullscreen);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountEdgeShields, { once: true });
    } else {
        mountEdgeShields();
    }

    tryFullscreen();
})();
