(function () {
    const DISMISS_KEY = 'ligeirinho-parceiros-pwa-install-dismissed';
    const DISMISS_DAYS = 14;

    let deferredPrompt = null;

    function isStandalone() {
        return (
            window.matchMedia('(display-mode: standalone)').matches ||
            window.matchMedia('(display-mode: fullscreen)').matches ||
            window.navigator.standalone === true
        );
    }

    function isIos() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    }

    function isAndroid() {
        return /Android/i.test(navigator.userAgent);
    }

    function isMobile() {
        return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    }

    function isBannerDismissed() {
        try {
            const raw = localStorage.getItem(DISMISS_KEY);
            if (!raw) return false;
            const elapsed = Date.now() - Number(raw);
            return Number.isFinite(elapsed) && elapsed < DISMISS_DAYS * 24 * 60 * 60 * 1000;
        } catch {
            return false;
        }
    }

    function dismissBanner() {
        try {
            localStorage.setItem(DISMISS_KEY, String(Date.now()));
        } catch {
            /* ignore */
        }
    }

    function getModalMode() {
        if (isStandalone()) return 'installed';
        if (isIos()) return 'ios';
        if (deferredPrompt) return 'native';
        if (isAndroid()) return 'android';
        return 'unavailable';
    }

    function stepsHtml(mode) {
        if (mode === 'ios') {
            return (
                '<ol class="lig-install-modal__steps">' +
                '<li><span class="lig-install-modal__num">1</span><span>Toque em <strong>Compartilhar</strong> no Safari</span></li>' +
                '<li><span class="lig-install-modal__num">2</span><span>Escolha <strong>Adicionar à Tela de Início</strong></span></li>' +
                '<li><span class="lig-install-modal__num">3</span><span>Confirme em <strong>Adicionar</strong></span></li>' +
                '</ol>'
            );
        }
        if (mode === 'android') {
            return (
                '<ol class="lig-install-modal__steps">' +
                '<li><span class="lig-install-modal__num">1</span><span>Toque nos <strong>três pontos</strong> (⋮) no Chrome</span></li>' +
                '<li><span class="lig-install-modal__num">2</span><span>Escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong></span></li>' +
                '<li><span class="lig-install-modal__num">3</span><span>Confirme em <strong>Instalar</strong></span></li>' +
                '</ol>'
            );
        }
        if (mode === 'native') {
            return '<p class="lig-install-modal__hint">Toque em instalar — o app vai para sua tela inicial em segundos.</p>';
        }
        if (mode === 'installed') {
            return '<p class="lig-install-modal__ok">Você já pode abrir pelo ícone na home.</p>';
        }
        return '<p class="lig-install-modal__hint">Abra no Chrome (Android) ou Safari (iPhone) para instalar o Ligeirinho Parceiros.</p>';
    }

    function onEscape(event) {
        if (event.key === 'Escape') closeModal();
    }

    function closeModal() {
        const overlay = document.getElementById('lig-install-modal');
        if (overlay) overlay.remove();
        document.body.classList.remove('lig-install-open');
        document.removeEventListener('keydown', onEscape);
    }

    function openModal() {
        const existing = document.getElementById('lig-install-modal');
        if (existing) existing.remove();

        const mode = getModalMode();
        const overlay = document.createElement('div');
        overlay.className = 'lig-install-modal';
        overlay.id = 'lig-install-modal';
        overlay.innerHTML =
            '<div class="lig-install-modal__backdrop" data-install-close aria-hidden="true"></div>' +
            '<div class="lig-install-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="lig-install-title">' +
            '<div class="lig-install-modal__head">' +
            '<div><h2 id="lig-install-title" class="lig-install-modal__title">' +
            (mode === 'installed' ? 'App instalado' : 'Baixar o app') +
            '</h2>' +
            '<p class="lig-install-modal__sub">Instale o Ligeirinho Parceiros — catálogo e pedidos na tela inicial.</p></div>' +
            '<button type="button" class="lig-install-modal__close" data-install-close aria-label="Fechar">' +
            '<span class="material-symbols-outlined" aria-hidden="true">close</span></button></div>' +
            '<div class="lig-install-modal__preview">' +
            '<img src="img/app-icon-192.png" alt="" width="48" height="48" />' +
            '<div><p class="lig-install-modal__app">Ligeirinho Parceiros</p><p class="lig-install-modal__meta">Catálogo · carrinho · pedidos</p></div></div>' +
            stepsHtml(mode) +
            '<div class="lig-install-modal__actions">' +
            (mode === 'native'
                ? '<button type="button" class="lig-install-modal__primary" id="lig-install-confirm">Instalar app</button>'
                : mode === 'ios' || mode === 'android'
                  ? '<button type="button" class="lig-install-modal__primary" data-install-close>Entendi</button>'
                  : '') +
            (mode !== 'installed'
                ? '<button type="button" class="lig-install-modal__ghost" data-install-close>Agora não</button>'
                : '') +
            '</div></div>';

        document.body.appendChild(overlay);
        document.body.classList.add('lig-install-open');

        overlay.querySelectorAll('[data-install-close]').forEach((el) => {
            el.addEventListener('click', closeModal);
        });

        const confirm = document.getElementById('lig-install-confirm');
        if (confirm) {
            confirm.addEventListener('click', async () => {
                if (!deferredPrompt) return;
                await deferredPrompt.prompt();
                const choice = await deferredPrompt.userChoice;
                if (choice.outcome === 'accepted') deferredPrompt = null;
                closeModal();
            });
        }

        document.addEventListener('keydown', onEscape);
    }

    function injectBanner() {
        if (isStandalone() || !isMobile() || isBannerDismissed()) return;
        const main = document.getElementById('lig-page-main');
        if (!main || main.querySelector('.lig-install-banner')) return;

        const banner = document.createElement('div');
        banner.className = 'lig-install-banner';
        banner.innerHTML =
            '<div class="lig-install-banner__copy">' +
            '<img src="img/app-icon-192.png" alt="" width="36" height="36" />' +
            '<div><p class="lig-install-banner__title">Baixar o app</p>' +
            '<p class="lig-install-banner__sub">Ligeirinho Parceiros na sua tela inicial</p></div></div>' +
            '<div class="lig-install-banner__actions">' +
            '<button type="button" class="lig-install-banner__btn">Baixar</button>' +
            '<button type="button" class="lig-install-banner__dismiss" aria-label="Dispensar">×</button></div>';

        main.insertBefore(banner, main.firstChild);

        banner.querySelector('.lig-install-banner__btn')?.addEventListener('click', openModal);
        banner.querySelector('.lig-install-banner__dismiss')?.addEventListener('click', () => {
            dismissBanner();
            banner.remove();
        });
    }

    function bindTriggers() {
        document.querySelectorAll('[data-install-trigger]').forEach((btn) => {
            if (btn.dataset.installBound === '1') return;
            btn.dataset.installBound = '1';
            btn.addEventListener('click', openModal);
        });
    }

    function updateInstallButtons() {
        document.querySelectorAll('[data-install-trigger]').forEach((btn) => {
            btn.hidden = isStandalone();
        });
    }

    let initialized = false;

    function init() {
        if (initialized) {
            bindTriggers();
            updateInstallButtons();
            return;
        }
        initialized = true;

        injectBanner();
        bindTriggers();
        updateInstallButtons();

        window.addEventListener('beforeinstallprompt', (event) => {
            event.preventDefault();
            deferredPrompt = event;
            bindTriggers();
        });

        window.addEventListener('appinstalled', () => {
            deferredPrompt = null;
            document.querySelector('.lig-install-banner')?.remove();
            updateInstallButtons();
        });
    }

    window.LigeirinhoInstall = {
        init,
        open: openModal,
        isStandalone,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
