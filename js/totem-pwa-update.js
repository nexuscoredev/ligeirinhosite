/**
 * Atualização sistêmica do totem (service worker) — espelha o fluxo do Hub.
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'lig-totem-pwa-update-pending-v1';
    const SW_URL = '/js/sw.js';
    const SW_SCOPE = '/';

    /** @type {'idle' | 'pending' | 'checking'} */
    let status = 'idle';
    let started = false;
    let aplicando = false;
    /** @type {ServiceWorkerRegistration | null} */
    let lastRegistration = null;
    const listeners = new Set();
    const registrationsWithListeners = new WeakSet();

    function lerPersistido() {
        try {
            return sessionStorage.getItem(STORAGE_KEY) === '1';
        } catch {
            return false;
        }
    }

    function persistirPendente(pendente) {
        try {
            if (pendente) sessionStorage.setItem(STORAGE_KEY, '1');
            else sessionStorage.removeItem(STORAGE_KEY);
        } catch {
            /* ignore */
        }
    }

    function emitir() {
        const detail = { status, pendente: status === 'pending' || lerPersistido() };
        window.dispatchEvent(new CustomEvent('lig-totem-pwa', { detail }));
        for (const fn of listeners) fn(detail);
    }

    function definirStatus(next) {
        status = next;
        emitir();
    }

    function sinalizarPendente() {
        persistirPendente(true);
        definirStatus('pending');
    }

    async function detectarSwAguardando() {
        if (!('serviceWorker' in navigator)) return false;
        const reg = lastRegistration ?? (await navigator.serviceWorker.getRegistration(SW_SCOPE));
        if (!reg?.waiting || !navigator.serviceWorker.controller) return false;
        sinalizarPendente();
        return true;
    }

    function vincularListenersRegistro(reg) {
        if (registrationsWithListeners.has(reg)) return;
        registrationsWithListeners.add(reg);

        reg.addEventListener('updatefound', () => {
            const installing = reg.installing;
            if (!installing) return;
            installing.addEventListener('statechange', () => {
                if (installing.state === 'installed' && reg.waiting && navigator.serviceWorker.controller) {
                    sinalizarPendente();
                }
            });
        });
    }

    async function registrarSw() {
        if (!('serviceWorker' in navigator)) return null;
        try {
            const reg = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
            lastRegistration = reg;
            vincularListenersRegistro(reg);
            await detectarSwAguardando();
            return reg;
        } catch {
            return null;
        }
    }

    async function verificar(opcoes) {
        const silencioso = opcoes?.silencioso ?? false;
        if (!('serviceWorker' in navigator)) return 'indisponivel';
        if (!silencioso) definirStatus('checking');

        try {
            const reg = lastRegistration ?? (await navigator.serviceWorker.getRegistration(SW_SCOPE));
            if (!reg) {
                if (!silencioso) definirStatus('idle');
                return 'indisponivel';
            }

            await reg.update();

            if (reg.waiting && navigator.serviceWorker.controller) {
                sinalizarPendente();
                return 'pendente';
            }

            if (await detectarSwAguardando()) return 'pendente';

            const pendente = status === 'pending' || lerPersistido();
            if (!silencioso) definirStatus(pendente ? 'pending' : 'idle');
            return pendente ? 'pendente' : 'em-dia';
        } catch {
            const pendente = status === 'pending' || lerPersistido();
            if (!silencioso) definirStatus(pendente ? 'pending' : 'idle');
            return 'indisponivel';
        }
    }

    async function aplicar() {
        if (aplicando) return;
        aplicando = true;
        persistirPendente(false);
        definirStatus('idle');

        try {
            const reg = lastRegistration ?? (await navigator.serviceWorker.getRegistration(SW_SCOPE));
            reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
        } finally {
            window.setTimeout(() => {
                if (document.visibilityState !== 'hidden') window.location.reload();
            }, 400);
        }
    }

    function init() {
        if (started) return;
        started = true;

        if (lerPersistido()) definirStatus('pending');

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!aplicando) return;
                persistirPendente(false);
                window.location.reload();
            });
        }

        void registrarSw().then(() => {
            window.setTimeout(() => void verificar({ silencioso: true }), 2000);

            const onVis = () => {
                if (document.visibilityState === 'visible') void verificar({ silencioso: true });
            };
            document.addEventListener('visibilitychange', onVis);

            window.addEventListener('pageshow', (ev) => {
                if (ev.persisted) void verificar({ silencioso: true });
            });

            const id = window.setInterval(() => void verificar({ silencioso: true }), 30_000);
            window.addEventListener(
                'beforeunload',
                () => {
                    document.removeEventListener('visibilitychange', onVis);
                    window.clearInterval(id);
                },
                { once: true },
            );
        });
    }

    window.LigeirinhoTotemPwaUpdate = {
        init,
        isPending: () => status === 'pending' || lerPersistido(),
        status: () => status,
        verificar,
        aplicar,
        onStatusChange(fn) {
            listeners.add(fn);
            fn({ status, pendente: status === 'pending' || lerPersistido() });
            return () => listeners.delete(fn);
        },
    };

    if (document.documentElement.classList.contains('totem-kiosk')) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init, { once: true });
        } else {
            init();
        }
    }
})();
