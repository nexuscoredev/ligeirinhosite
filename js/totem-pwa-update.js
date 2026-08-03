/**
 * Atualização sistêmica do totem (service worker).
 * Aplica sozinho com barra de progresso — sem botão "Atualizar".
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
    let autoApplyTimer = 0;
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
        const pendente = status === 'pending' || lerPersistido();
        const aplicandoAgora = status === 'applying' || aplicando;
        const visivel = aplicandoAgora || pendente;
        root.hidden = !visivel;
        document.body.classList.toggle('lig-pwa-update-open', visivel);

        const etapaEl = document.getElementById('lig-totem-pwa-etapa');
        const pctEl = document.getElementById('lig-totem-pwa-pct');
        const fillEl = document.getElementById('lig-totem-pwa-fill');
        const chip = root.querySelector('.lig-pwa-update__chip');
        const pct = Math.min(100, Math.max(0, Math.round(progresso)));
        const concluido = pct >= 100;
        if (etapaEl) etapaEl.textContent = concluido ? 'Atualizado' : etapa || 'Atualizando…';
        if (pctEl) pctEl.textContent = pct + '%';
        if (fillEl) fillEl.style.width = pct + '%';
        if (chip) {
            chip.setAttribute('aria-busy', concluido ? 'false' : 'true');
            chip.setAttribute('aria-valuenow', String(pct));
        }
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
        if (next === 'pending') agendarAplicacaoAutomatica();
    }

    function agendarAplicacaoAutomatica() {
        if (aplicando || autoApplyTimer) return;
        autoApplyTimer = window.setTimeout(() => {
            autoApplyTimer = 0;
            void aplicar();
        }, 400);
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
        if (autoApplyTimer) {
            window.clearTimeout(autoApplyTimer);
            autoApplyTimer = 0;
        }
        persistirPendente(false);
        status = 'applying';
        reportarProgresso(5, 'Iniciando…');
        emitir();

        try {
            reportarProgresso(20, 'Baixando versão…');
            await new Promise((r) => window.setTimeout(r, 80));

            reportarProgresso(45, 'Ativando…');
            const reg = lastRegistration ?? (await navigator.serviceWorker.getRegistration(SW_SCOPE));
            reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });

            reportarProgresso(75, 'Aplicando…');
            await new Promise((r) => window.setTimeout(r, 100));

            reportarProgresso(92, 'Recarregando…');
            window.setTimeout(() => {
                reportarProgresso(100, 'Pronto');
                if (document.visibilityState !== 'hidden') window.location.reload();
            }, 250);
        } catch {
            aplicando = false;
            status = 'pending';
            persistirPendente(true);
            reportarProgresso(0, 'Falha ao atualizar');
            emitir();
            agendarAplicacaoAutomatica();
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
                reportarProgresso(100, 'Pronto');
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
