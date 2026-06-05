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
    ensureMeta('apple-mobile-web-app-title', 'Ligeirinho');
    ensureLink('manifest', 'manifest.webmanifest');

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/js/sw.js', { scope: '/' }).catch(() => {});
        });
    }

    const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;

    if (isStandalone) {
        document.documentElement.classList.add('lig-app-standalone');
    }

    let deferredPrompt = null;

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        showInstallBanner();
    });

    const dismissKey = 'ligeirinho-install-dismissed';

    const showInstallBanner = () => {
        if (isStandalone || localStorage.getItem(dismissKey)) return;
        if (document.getElementById('app-install-banner')) return;

        const banner = document.createElement('div');
        banner.id = 'app-install-banner';
        banner.className =
            'fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-4 right-4 z-[65] md:bottom-6 md:left-auto md:right-6 md:max-w-sm';
        banner.innerHTML = `<div class="flex items-center gap-3 rounded-xl border border-[var(--lig-border)] bg-[var(--lig-surface)] shadow-lg px-4 py-3">
<img src="img/ligeirinhologo.png" alt="" class="h-10 w-10 shrink-0 rounded-lg object-contain" width="40" height="40">
<div class="min-w-0 flex-1">
<p class="text-sm font-bold lig-cart-text leading-tight">Instalar Ligeirinho App</p>
<p class="text-xs lig-cart-text-muted mt-0.5">Acesso rápido ao catálogo e pedidos</p>
</div>
<button type="button" id="app-install-btn" class="shrink-0 rounded-full bg-vibrant-orange px-3 py-2 text-xs font-bold text-white min-h-[36px]">Instalar</button>
<button type="button" id="app-install-dismiss" class="shrink-0 p-1 lig-cart-text-muted hover:lig-cart-text" aria-label="Fechar">
<span class="material-symbols-outlined text-[20px]">close</span>
</button>
</div>`;

        document.body.appendChild(banner);

        banner.querySelector('#app-install-btn')?.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            deferredPrompt = null;
            banner.remove();
        });

        banner.querySelector('#app-install-dismiss')?.addEventListener('click', () => {
            localStorage.setItem(dismissKey, '1');
            banner.remove();
        });
    };

    window.LigeirinhoApp = { isStandalone, promptInstall: () => deferredPrompt?.prompt() };
})();
