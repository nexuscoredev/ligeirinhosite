(function () {
    const PROMPT_DISMISS_KEY = 'ligeirinho-push-prompt-dismissed-v1';
    const PROMPT_DISMISS_DAYS = 5;
    const PROMPT_DELAY_MS = 2200;

    const urlBase64ToUint8Array = (base64String) => {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const raw = atob(base64);
        const output = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
        return output;
    };

    const accountHeaders = async () => {
        const auth = window.LigeirinhoAuth;
        const headers = { 'Content-Type': 'application/json' };
        const hubToken = await auth?.getHubAccessToken?.();
        if (hubToken) {
            headers.Authorization = `Bearer ${hubToken}`;
            return headers;
        }
        let accountToken = auth?.getAccountSessionToken?.();
        if (!accountToken) accountToken = await auth?.ensureAccountSession?.();
        if (accountToken) {
            headers['X-Account-Session'] = accountToken;
            return headers;
        }
        const googleCred = auth?.getGoogleCredential?.();
        const session = auth?.loadSession?.();
        if (googleCred) {
            headers['X-Google-Credential'] = googleCred;
            if (session?.hubUserId) headers['X-Hub-User-Id'] = session.hubUserId;
            return headers;
        }
        if (session?.provider === 'google' && session?.email) {
            headers['X-Auth-Provider'] = 'google';
            headers['X-Account-Email'] = session.email;
            if (session.hubUserId) headers['X-Hub-User-Id'] = session.hubUserId;
            return headers;
        }
        throw new Error('Entre na conta para ativar notificações.');
    };

    const supported = () =>
        typeof window !== 'undefined' &&
        'Notification' in window &&
        'serviceWorker' in navigator &&
        'PushManager' in window;

    const isStandalone = () =>
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.navigator.standalone === true;

    const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    const isLoggedIn = () => {
        const session = window.LigeirinhoAuth?.loadSession?.();
        return Boolean(session?.sub || session?.hubUserId || session?.email);
    };

    const pageAllowsPrompt = () => {
        const page = String(document.body?.dataset?.page || '').toLowerCase();
        if (!page || page === 'login') return false;
        if (page.startsWith('totem') || page === 'caixa' || page === 'separacao' || page === 'financeiro') {
            return false;
        }
        return true;
    };

    const isPromptDismissed = () => {
        try {
            const raw = localStorage.getItem(PROMPT_DISMISS_KEY);
            if (!raw) return false;
            const elapsed = Date.now() - Number(raw);
            return Number.isFinite(elapsed) && elapsed < PROMPT_DISMISS_DAYS * 24 * 60 * 60 * 1000;
        } catch {
            return false;
        }
    };

    const dismissPrompt = () => {
        try {
            localStorage.setItem(PROMPT_DISMISS_KEY, String(Date.now()));
        } catch {
            /* ignore */
        }
    };

    const clearPromptDismiss = () => {
        try {
            localStorage.removeItem(PROMPT_DISMISS_KEY);
        } catch {
            /* ignore */
        }
    };

    async function fetchPublicKey() {
        const res = await fetch('/api/push/vapid-public-key');
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.publicKey) {
            throw new Error(data.error || 'Chave VAPID indisponível.');
        }
        return data.publicKey;
    }

    async function ensureSwRegistration() {
        const existing = await navigator.serviceWorker.getRegistration('/');
        if (existing) return existing;
        return navigator.serviceWorker.register('/js/sw.js', { scope: '/' });
    }

    /**
     * Pede permissão, assina Web Push e envia subscription ao backend.
     * @param {{ orderId?: string, silent?: boolean }} [opts]
     */
    async function enableOrderStatusPush(opts = {}) {
        if (!supported()) {
            throw new Error('Este aparelho não suporta notificações push.');
        }

        if (Notification.permission === 'denied') {
            throw new Error('Notificações bloqueadas neste aparelho. Libere nas configurações do navegador.');
        }

        if (opts.silent && Notification.permission !== 'granted') {
            return { ok: false, reason: 'needs_permission' };
        }

        const permission =
            Notification.permission === 'granted'
                ? 'granted'
                : await Notification.requestPermission();
        if (permission !== 'granted') {
            throw new Error('Permissão de notificação negada.');
        }

        const reg = await ensureSwRegistration();
        await navigator.serviceWorker.ready;

        const publicKey = await fetchPublicKey();
        let subscription = await reg.pushManager.getSubscription();
        if (!subscription) {
            subscription = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey),
            });
        }

        const headers = await accountHeaders();
        const res = await fetch('/api/push/subscribe', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                subscription: subscription.toJSON(),
                orderId: opts.orderId || undefined,
            }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.error || data.hint || 'Não foi possível ativar as notificações.');
        }
        clearPromptDismiss();
        return { ok: true, subscription };
    }

    /** Reenvia subscription se a permissão já foi concedida (sem prompt). */
    async function ensureSubscribed(opts = {}) {
        try {
            return await enableOrderStatusPush({ ...opts, silent: true });
        } catch {
            return { ok: false };
        }
    }

    async function showLocalOrderStatus(tracking, order) {
        if (!supported() || Notification.permission !== 'granted') return;
        const shortId = String(order?.id || '')
            .replace(/-/g, '')
            .slice(0, 8)
            .toUpperCase();
        const title = tracking?.cancelled
            ? 'Pedido cancelado'
            : tracking?.headerTitle || tracking?.stepLabel || 'Atualização do pedido';
        const body = tracking?.message || `Pedido ${shortId}`;
        const reg = await navigator.serviceWorker.getRegistration('/');
        const opts = {
            body,
            icon: 'img/app-icon-light-192.png',
            badge: 'img/app-icon-light-192.png',
            tag: order?.id
                ? `order-${order.id}-${Date.now()}`
                : `order-local-${Date.now()}`,
            renotify: true,
            data: {
                url: order?.id
                    ? `pedido-confirmado.html?order=${encodeURIComponent(order.id)}`
                    : 'meus-pedidos.html',
            },
        };
        if (reg?.showNotification) {
            await reg.showNotification(`Ligeirinho · ${title}`, opts);
            return;
        }
        // eslint-disable-next-line no-new
        new Notification(`Ligeirinho · ${title}`, opts);
    }

    /** Notificação de sistema (cascata) para itens do hub/app. */
    async function showSystemNotification({ id, title, body, url }) {
        if (!supported() || Notification.permission !== 'granted') return false;
        const reg = await navigator.serviceWorker.getRegistration('/');
        const opts = {
            body: body || '',
            icon: '/img/app-icon-light-192.png',
            badge: '/img/app-icon-light-192.png',
            tag: `parceiros-${id || Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            renotify: true,
            data: { url: url || '/meus-pedidos' },
        };
        if (reg?.showNotification) {
            await reg.showNotification(title || 'Ligeirinho Parceiros', opts);
            return true;
        }
        // eslint-disable-next-line no-new
        new Notification(title || 'Ligeirinho Parceiros', opts);
        return true;
    }

    const closePromptModal = () => {
        document.getElementById('lig-push-prompt')?.remove();
        document.body.classList.remove('lig-push-prompt-open');
    };

    const openPromptModal = ({ mode = 'enable' } = {}) => {
        closePromptModal();
        const needsInstall = mode === 'install' || (isIos() && !isStandalone());
        const overlay = document.createElement('div');
        overlay.id = 'lig-push-prompt';
        overlay.className = 'lig-push-prompt';
        overlay.innerHTML = `
<div class="lig-push-prompt__backdrop" data-push-prompt-dismiss tabindex="-1" aria-hidden="true"></div>
<div class="lig-push-prompt__dialog" role="dialog" aria-modal="true" aria-labelledby="lig-push-prompt-title">
<div class="lig-push-prompt__icon" aria-hidden="true">
<span class="material-symbols-outlined">notifications_active</span>
</div>
<h2 id="lig-push-prompt-title" class="lig-push-prompt__title">${
            needsInstall ? 'Receba alertas no celular' : 'Ativar notificações?'
        }</h2>
<p class="lig-push-prompt__body">${
            needsInstall
                ? 'No iPhone, instale o Ligeirinho Parceiros na tela inicial e depois ative as notificações para saber quando o pedido for aceito ou sair para entrega.'
                : 'Quer saber na hora quando o pedido for aceito, sair para entrega ou for entregue? Ative os alertas na tela do aparelho.'
        }</p>
<p id="lig-push-prompt-status" class="lig-push-prompt__status" hidden></p>
<div class="lig-push-prompt__actions">
${
    needsInstall
        ? `<button type="button" class="lig-push-prompt__primary" data-push-prompt-install>Baixar app</button>`
        : `<button type="button" class="lig-push-prompt__primary" data-push-prompt-enable>Ativar alertas</button>`
}
<button type="button" class="lig-push-prompt__ghost" data-push-prompt-dismiss>Agora não</button>
</div>
</div>`;
        document.body.appendChild(overlay);
        document.body.classList.add('lig-push-prompt-open');

        const statusEl = overlay.querySelector('#lig-push-prompt-status');
        const setStatus = (msg, isError = false) => {
            if (!statusEl) return;
            statusEl.hidden = !msg;
            statusEl.textContent = msg || '';
            statusEl.classList.toggle('lig-push-prompt__status--error', Boolean(isError));
        };

        overlay.querySelectorAll('[data-push-prompt-dismiss]').forEach((el) => {
            el.addEventListener('click', () => {
                dismissPrompt();
                closePromptModal();
            });
        });

        overlay.querySelector('[data-push-prompt-install]')?.addEventListener('click', () => {
            dismissPrompt();
            closePromptModal();
            if (window.LigeirinhoInstall?.open) {
                window.LigeirinhoInstall.open();
            } else {
                window.location.href = 'baixar-app.html';
            }
        });

        overlay.querySelector('[data-push-prompt-enable]')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true;
            btn.textContent = 'Ativando…';
            setStatus('');
            try {
                await enableOrderStatusPush();
                setStatus('Alertas ativados. Você receberá avisos na tela do aparelho.');
                window.setTimeout(closePromptModal, 900);
                window.dispatchEvent(new CustomEvent('ligeirinho-notifications-changed'));
            } catch (err) {
                btn.disabled = false;
                btn.textContent = 'Ativar alertas';
                setStatus(err?.message || 'Não foi possível ativar as notificações.', true);
            }
        });
    };

    let promptTimer = null;

    /**
     * Mostra o pedido de habilitação se o parceiro ainda não ativou.
     * @param {{ force?: boolean, delayMs?: number }} [opts]
     */
    function maybePromptEnable(opts = {}) {
        if (promptTimer) {
            clearTimeout(promptTimer);
            promptTimer = null;
        }
        if (document.getElementById('lig-push-prompt')) return;
        if (!pageAllowsPrompt()) return;
        if (!isLoggedIn()) return;
        if (!opts.force && isPromptDismissed()) return;

        const delay = opts.delayMs ?? PROMPT_DELAY_MS;
        promptTimer = window.setTimeout(() => {
            promptTimer = null;
            if (!isLoggedIn() || !pageAllowsPrompt()) return;
            if (!opts.force && isPromptDismissed()) return;

            // iOS no Safari: push só funciona no app instalado.
            if (isIos() && !isStandalone()) {
                openPromptModal({ mode: 'install' });
                return;
            }

            if (!supported()) return;
            if (Notification.permission === 'granted') {
                void ensureSubscribed();
                return;
            }
            if (Notification.permission === 'denied') return;

            openPromptModal({ mode: 'enable' });
        }, delay);
    }

    window.LigeirinhoPush = {
        supported,
        enableOrderStatusPush,
        ensureSubscribed,
        showLocalOrderStatus,
        showSystemNotification,
        maybePromptEnable,
        permission: () => (supported() ? Notification.permission : 'unsupported'),
    };
})();
