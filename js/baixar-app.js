(function () {
    const root = document.getElementById('baixar-app-root');
    if (!root) return;

    const esc = (v) =>
        String(v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');

    const isStandalone = () =>
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.navigator.standalone === true;

    const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isAndroid = () => /Android/i.test(navigator.userAgent);
    const isMobile = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

    const siteOrigin = () => {
        const site = window.LigeirinhoSite?.get?.() || window.LigeirinhoSite;
        const productionUrl = String(site?.productionUrl || '').replace(/\/$/, '');
        if (productionUrl) return productionUrl;
        return window.location.origin.replace(/\/$/, '');
    };

    const installPageUrl = () => `${siteOrigin()}/baixar-app`;
    const homeUrl = () => `${siteOrigin()}/`;

    const qrSrc = (size = 360) =>
        `/api/app-qr?size=${encodeURIComponent(size)}&t=${Date.now().toString(36)}`;

    const mobileSteps = () => {
        if (isStandalone()) {
            return '<p class="baixar-app__hint">Você já está no app. Use o atalho na tela inicial.</p>';
        }
        if (isIos()) {
            return `<ol class="baixar-app__steps">
<li><span>1</span><span>Toque em <strong>Compartilhar</strong> no Safari</span></li>
<li><span>2</span><span>Escolha <strong>Adicionar à Tela de Início</strong></span></li>
<li><span>3</span><span>Confirme em <strong>Adicionar</strong></span></li>
</ol>`;
        }
        if (isAndroid()) {
            return `<ol class="baixar-app__steps">
<li><span>1</span><span>Toque nos <strong>três pontos</strong> (⋮) no Chrome</span></li>
<li><span>2</span><span>Escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong></span></li>
<li><span>3</span><span>Confirme em <strong>Instalar</strong></span></li>
</ol>`;
        }
        return '<p class="baixar-app__hint">Abra este link no Chrome (Android) ou Safari (iPhone) para instalar.</p>';
    };

    const render = () => {
        const url = installPageUrl();
        const mobile = isMobile();
        const installed = isStandalone();

        root.innerHTML = `<section class="baixar-app__hero">
<div class="baixar-app__brand">
<img src="img/app-icon-light-192.png" alt="" width="56" height="56">
<div>
<p class="baixar-app__eyebrow">Ligeirinho Parceiros</p>
<h1 class="baixar-app__title">${installed ? 'App instalado' : mobile ? 'Instale o app' : 'Baixe o app no celular'}</h1>
<p class="baixar-app__sub">${
            installed
                ? 'O Ligeirinho Parceiros já está na sua tela inicial.'
                : mobile
                  ? 'Siga os passos abaixo para colocar o app na tela inicial.'
                  : 'Aponte a câmera do celular para o QR code e instale em poucos toques.'
        }</p>
</div>
</div>

${
    mobile
        ? `<div class="baixar-app__panel baixar-app__panel--mobile">
${mobileSteps()}
<div class="baixar-app__actions">
${
    installed
        ? `<a class="baixar-app__btn baixar-app__btn--primary" href="${esc(homeUrl())}">Ir ao catálogo</a>`
        : `<button type="button" class="baixar-app__btn baixar-app__btn--primary" data-baixar-install>Baixar / instalar</button>
<a class="baixar-app__btn baixar-app__btn--ghost" href="${esc(homeUrl())}">Abrir o site</a>`
}
</div>
</div>`
        : `<div class="baixar-app__panel">
<figure class="baixar-app__qr-wrap">
<img class="baixar-app__qr" id="baixar-app-qr" src="${esc(qrSrc(400))}" width="400" height="400" alt="QR code para baixar o Ligeirinho Parceiros">
</figure>
<p class="baixar-app__url">${esc(url)}</p>
<div class="baixar-app__actions">
<a class="baixar-app__btn baixar-app__btn--primary" href="/api/app-qr?download=1&size=512" download="ligeirinho-parceiros-app-qr.png">Baixar QR code</a>
<button type="button" class="baixar-app__btn baixar-app__btn--ghost" data-baixar-copy>Copiar link</button>
</div>
<p class="baixar-app__footnote">Imprima ou envie o QR para o parceiro escanear com o celular.</p>
</div>`
}
</section>`;

        root.querySelector('[data-baixar-copy]')?.addEventListener('click', async (ev) => {
            const btn = ev.currentTarget;
            try {
                await navigator.clipboard.writeText(url);
                btn.textContent = 'Link copiado';
                window.setTimeout(() => {
                    btn.textContent = 'Copiar link';
                }, 1800);
            } catch {
                window.prompt('Copie o link:', url);
            }
        });

        root.querySelector('[data-baixar-install]')?.addEventListener('click', () => {
            if (window.LigeirinhoInstall?.open) {
                window.LigeirinhoInstall.open();
                return;
            }
            const trigger = document.querySelector('[data-install-trigger]');
            if (trigger) trigger.click();
        });
    };

    const boot = () => {
        render();
        // ensure install helpers after layout scripts
        const s = document.createElement('script');
        s.src = 'js/install-app.js';
        s.defer = true;
        document.body.appendChild(s);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();
