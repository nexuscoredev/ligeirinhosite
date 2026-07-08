(function () {
    const ensureMeta = (name, content) => {
        if (document.querySelector(`meta[name="${name}"]`)) return;
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

    ensureMeta('theme-color', window.LigeirinhoTheme?.getEffective?.() === 'dark' ? '#121212' : '#ffffff');
    ensureMeta('mobile-web-app-capable', 'yes');
    ensureMeta('apple-mobile-web-app-capable', 'yes');
    ensureMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
    ensureMeta('apple-mobile-web-app-title', 'Ligeirinho Parceiros');
    ensureLink('manifest', 'manifest.webmanifest');
    ensureLink('stylesheet', 'css/theme-forms.css');

    const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.navigator.standalone === true;

    if (isStandalone) {
        document.documentElement.classList.add('lig-app-standalone');
    }

    window.LigeirinhoApp = {
        isStandalone,
        promptInstall: () => window.LigeirinhoInstall?.open?.(),
    };
})();
