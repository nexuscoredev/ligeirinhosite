(function () {
    let cache = null;

    const load = async () => {
        if (cache) return cache;
        try {
            const res = await fetch('/data/site.json');
            if (res.ok) cache = await res.json();
        } catch {
            /* offline */
        }
        cache = cache || {
            productionUrl: '',
            hosting: { provider: 'vercel', project: 'ligeirinhosite' },
        };
        return cache;
    };

    const canonicalPath = () => {
        const path = window.location.pathname.replace(/\/$/, '') || '/';
        if (path === '/' || path === '/index.html') return '/';
        return path.endsWith('.html') ? path.replace(/\.html$/, '') : path;
    };

    const applyCanonical = (baseUrl) => {
        const base = String(baseUrl || '').trim().replace(/\/$/, '');
        if (!base || document.querySelector('link[rel="canonical"]')) return;
        const link = document.createElement('link');
        link.rel = 'canonical';
        link.href = `${base}${canonicalPath()}`;
        document.head.appendChild(link);
    };

    const applyOgUrl = (baseUrl) => {
        const base = String(baseUrl || '').trim().replace(/\/$/, '');
        if (!base || document.querySelector('meta[property="og:url"]')) return;
        const meta = document.createElement('meta');
        meta.setAttribute('property', 'og:url');
        meta.content = `${base}${canonicalPath()}`;
        document.head.appendChild(meta);
    };

    const init = async () => {
        const site = await load();
        if (site.productionUrl) {
            applyCanonical(site.productionUrl);
            applyOgUrl(site.productionUrl);
        }
        window.LigeirinhoSite = { load, get: () => cache, ...site };
        window.dispatchEvent(new CustomEvent('ligeirinho-site-ready', { detail: site }));
        return site;
    };

    window.LigeirinhoSiteConfig = { load, init };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => init(), { once: true });
    } else {
        init();
    }
})();
