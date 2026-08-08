/**
 * Atualização sistêmica do totem (service worker).
 * Botão "Atualizar" no header quando há versão pendente; barra ao aplicar.
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'lig-totem-pwa-update-pending-v1';
    const SW_URL = '/js/sw.js';
    const SW_SCOPE = '/';

    /** @type {'idle' | 'pending' | 'checking' | 'applying'} */
    let status = 'idle';
    let started = false;
    let aplicando = false;
    let reloadAgendado = false;
    let progresso = 0;
    let etapa = 'Atualizando…';
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

    function reportarProgresso(pct, label) {
        progresso = Math.max(0, Math.min(100, Math.round(pct)));
        if (label) etapa = label;
        syncBanner();
    }

    function ensureBanner() {
        const existing = document.getElementById('lig-totem-pwa-update');
        if (
            existing &&
            (existing.querySelector('.lig-pwa-update__primary, .lig-pwa-update__ghost, .lig-pwa-update__actions') ||
                !existing.querySelector('.lig-pwa-update__chip'))
        ) {
            existing.remove();
        }
        if (document.getElementById('lig-totem-pwa-update')) return;
        const root = document.createElement('div');
        root.id = 'lig-totem-pwa-update';
        root.className = 'lig-pwa-update';
        root.setAttribute('role', 'status');
        root.setAttribute('aria-live', 'polite');
        root.hidden = true;
        root.innerHTML =
            '<div class="lig-pwa-update__chip" aria-busy="true">' +
            '<div class="lig-pwa-update__progresso">' +
            '<div class="lig-pwa-update__topo">' +
            '<span class="lig-pwa-update__etapa" id="lig-totem-pwa-etapa">Atualizando…</span>' +
            '<span class="lig-pwa-update__pct" id="lig-totem-pwa-pct">0%</span>' +
            '</div>' +
            '<div class="lig-pwa-update__barra" aria-hidden="true">' +
            '<div class="lig-pwa-update__barra-fill" id="lig-totem-pwa-fill" style="width:0%"></div>' +
            '</div>' +
            '</div>' +
            '</div>';
        document.body.appendChild(root);
    }

    function syncBanner() {
        ensureBanner();
        const root = document.getElementById('lig-totem-pwa-update');
        if (!root) return;
        // Só mostra barra enquanto aplica — pendente fica silencioso (evita flicker/crash).
        const aplicandoAgora = status === 'applying' || aplicando;
        root.hidden = !aplicandoAgora;
        document.body.classList.toggle('lig-pwa-update-open', aplicandoAgora);
        if (!aplicandoAgora) return;

        const etapaEl = document.getElementById('lig-totem-pwa-etapa');
        const pctEl = document.getElementById('lig-totem-pwa-pct');
        const fillEl = document.getElementById('lig-totem-pwa-fill');
        const pct = Math.min(100, Math.max(0, Math.round(progresso)));
        if (etapaEl) etapaEl.textContent = pct >= 100 ? 'Atualizado' : etapa || 'Atualizando…';
        if (pctEl) pctEl.textContent = pct + '%';
        if (fillEl) fillEl.style.width = pct + '%';
    }

    function emitir() {
        const detail = {
            status,
            pendente: status === 'pending' || lerPersistido(),
            progresso,
            etapa,
        };
        window.dispatchEvent(new CustomEvent('lig-totem-pwa', { detail }));
        for (const fn of listeners) fn(detail);
        syncBanner();
    }

    function definirStatus(next) {
        status = next;
        emitir();
        // No totem a aplicação segura fica a cargo do totem.js (tela de boas-vindas).
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
        if (aplicando) return 'pendente';
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

            // Sem waiting: limpa falso pendente (não recarrega).
            if (status === 'pending' || lerPersistido()) {
                persistirPendente(false);
                if (!silencioso) definirStatus('idle');
                else status = 'idle';
            } else if (!silencioso) {
                definirStatus('idle');
            }
            return 'em-dia';
        } catch {
            if (!silencioso) definirStatus(lerPersistido() ? 'pending' : 'idle');
            return 'indisponivel';
        }
    }

    let reloadAgendado = false;

    function recarregarUmaVez() {
        if (reloadAgendado) return;
        reloadAgendado = true;
        reportarProgresso(100, 'Pronto');
        const url = location.pathname + location.search + location.hash;
        window.setTimeout(() => {
            try {
                window.location.replace(url);
            } catch {
                window.location.reload();
            }
        }, 120);
    }

    async function aplicar() {
        if (aplicando || reloadAgendado) return;

        const reg = lastRegistration ?? (await navigator.serviceWorker.getRegistration(SW_SCOPE));
        const temWaiting = Boolean(reg?.waiting && navigator.serviceWorker.controller);
        if (!temWaiting) {
            persistirPendente(false);
            status = 'idle';
            progresso = 0;
            emitir();
            return;
        }

        aplicando = true;
        persistirPendente(false);
        status = 'applying';
        reportarProgresso(8, 'Iniciando…');
        emitir();

        try {
            reportarProgresso(40, 'Ativando…');
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            reportarProgresso(75, 'Aplicando…');
            window.setTimeout(() => {
                if (!reloadAgendado) recarregarUmaVez();
            }, 1800);
        } catch {
            aplicando = false;
            status = 'pending';
            persistirPendente(true);
            progresso = 0;
            emitir();
        }
    }

    function init() {
        if (started) return;
        started = true;
        ensureBanner();

        if (lerPersistido()) definirStatus('pending');

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!aplicando) return;
                persistirPendente(false);
                recarregarUmaVez();
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

            const id = window.setInterval(() => void verificar({ silencioso: true }), 5 * 60 * 1000);
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
        isPending: () => status === 'pending' || status === 'applying' || lerPersistido(),
        status: () => status,
        verificar,
        aplicar,
        onStatusChange(fn) {
            listeners.add(fn);
            fn({
                status,
                pendente: status === 'pending' || lerPersistido(),
                progresso,
                etapa,
            });
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
