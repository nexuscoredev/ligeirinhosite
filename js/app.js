(function () {
    const ensureMeta = (name, content, { replace = false } = {}) => {
        const existing = document.querySelector(`meta[name="${name}"]`);
        if (existing) {
            if (replace) existing.content = content;
            return;
        }
        const meta = document.createElement('meta');
        meta.name = name;
        meta.content = content;
        document.head.appendChild(meta);
    };

    const ensureLink = (rel, href, extra = {}) => {
        if (document.querySelector(`link[rel="${rel}"][href="${href}"]`)) return;
        const link = document.createElement('link');
        link.rel = rel;
        link.href = href;
        Object.entries(extra).forEach(([key, value]) => {
            link.setAttribute(key, value);
        });
        document.head.appendChild(link);
    };

    ensureMeta(
        'theme-color',
        window.LigeirinhoTheme?.getEffective?.() === 'dark' ? '#0d0d0d' : '#ffffff',
        { replace: true },
    );
    ensureMeta('mobile-web-app-capable', 'yes');
    ensureMeta('apple-mobile-web-app-capable', 'yes');
    ensureMeta('apple-mobile-web-app-status-bar-style', 'black-translucent', { replace: true });
    ensureMeta('apple-mobile-web-app-title', 'Ligeirinho Parceiros');
    ensureLink('manifest', 'manifest.webmanifest');
    ensureLink('stylesheet', 'css/theme-forms.css');

    const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.navigator.standalone === true;

    /* Safe areas: sempre (viewport-fit=cover). Padding só no header stack — ver CSS. */
    document.documentElement.classList.add('lig-app-safe-areas');
    if (isStandalone) {
        document.documentElement.classList.add('lig-app-standalone');
    }

    /* iOS PWA: status bar translúcida precisa estar setada antes do paint */
    if (isStandalone || /iP(hone|od|ad)/.test(navigator.userAgent)) {
        ensureMeta('apple-mobile-web-app-status-bar-style', 'black-translucent', { replace: true });
    }

    window.LigeirinhoApp = {
        isStandalone,
        promptInstall: () => window.LigeirinhoInstall?.open?.(),
    };
})();
