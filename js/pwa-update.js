/**
 * Atualização sistêmica do Ligeirinho Parceiros (service worker).
 * Aplica sozinha com barra de progresso — mas só em momento seguro
 * (não no meio de digitação, modal ou interação recente).
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'lig-parceiros-pwa-update-pending-v1';
    const SW_URL = '/js/sw.js';
    const SW_SCOPE = '/';
    /** Sem interação tipável por este tempo → pode aplicar. */
    const IDLE_MS = 10_000;
    const RETRY_MS = 1_200;

    /** @type {'idle' | 'pending' | 'checking' | 'applying' | 'waiting'} */
    let status = 'idle';
    let started = false;
    let aplicando = false;
    let autoApplyTimer = 0;
    let progresso = 0;
    let etapa = 'Atualizando…';
    let lastActivityAt = 0;
    let activityBound = false;
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

    function isTotemPage() {
        return (
            document.documentElement.classList.contains('totem-kiosk') ||
            document.body?.dataset?.page === 'totem' ||
            document.body?.dataset?.page === 'totem-pagamento' ||
            document.body?.dataset?.page === 'totem-sucesso' ||
            document.body?.dataset?.page === 'totem-caixa'
        );
    }

    function marcarAtividade() {
        lastActivityAt = Date.now();
    }

    function elementoEditavel(el) {
        if (!el || el === document.body || el === document.documentElement) return false;
        const tag = String(el.tagName || '').toUpperCase();
        if (tag === 'INPUT') {
            const type = String(el.type || 'text').toLowerCase();
            if (
                type === 'button' ||
                type === 'submit' ||
                type === 'reset' ||
                type === 'checkbox' ||
                type === 'radio' ||
                type === 'file' ||
                type === 'hidden' ||
                type === 'image'
            ) {
                return false;
            }
            return !el.disabled && !el.readOnly;
        }
        if (tag === 'TEXTAREA' || tag === 'SELECT') return !el.disabled && !el.readOnly;
        if (el.isContentEditable) return true;
        return false;
    }

    function overlayBloqueanteAberto() {
        if (document.body.classList.contains('lig-push-prompt-open')) return true;
        if (document.body.classList.contains('lig-install-modal-open')) return true;
        if (document.getElementById('lig-push-prompt')) return true;
        if (document.querySelector('.lig-promo-entry-notice--open')) return true;
        if (document.querySelector('.lig-cart-sheet.is-open, .lig-cart-panel.is-open, body.lig-cart-open')) {
            return true;
        }
        // Pickers / sheets do resumo e formulários
        if (document.querySelector('.resumo-shell--picker')) return true;
        if (document.querySelector('[role="dialog"]:not([hidden]):not([aria-hidden="true"])')) return true;
        if (document.querySelector('dialog[open]')) return true;
        return false;
    }

    function formularioEmEnvio() {
        const busy = document.querySelector(
            'button[disabled][aria-busy="true"], button.resumo-confirm-btn[disabled], .resumo-confirm-btn[aria-busy="true"]',
        );
        return Boolean(busy);
    }

    /** true = usuário no meio de algo — não recarregar. */
    function usuarioOcupado() {
        if (document.visibilityState === 'hidden') return true;
        if (elementoEditavel(document.activeElement)) return true;
        if (overlayBloqueanteAberto()) return true;
        if (formularioEmEnvio()) return true;
        if (lastActivityAt && Date.now() - lastActivityAt < IDLE_MS) return true;
        return false;
    }

    function bindActivityTracking() {
        if (activityBound) return;
        activityBound = true;
        const onAct = () => marcarAtividade();
        document.addEventListener('keydown', onAct, true);
        document.addEventListener('input', onAct, true);
        document.addEventListener('change', onAct, true);
        document.addEventListener('compositionstart', onAct, true);
        document.addEventListener('pointerdown', (ev) => {
            if (elementoEditavel(ev.target) || ev.target?.closest?.('form, .resumo-shell, .lig-cart-sheet, [role="dialog"]')) {
                marcarAtividade();
            }
        }, true);
        document.addEventListener('focusin', (ev) => {
            if (elementoEditavel(ev.target)) marcarAtividade();
        }, true);
    }

    function reportarProgresso(pct, label) {
        progresso = Math.max(0, Math.min(100, Math.round(pct)));
        if (label) etapa = label;
        syncBanner();
    }

    function ensureBanner() {
        const existing = document.getElementById('lig-pwa-update');
        if (
            existing &&
            (existing.querySelector(
                '#lig-pwa-update-apply, #lig-pwa-update-later, .lig-pwa-update__primary, .lig-pwa-update__ghost, .lig-pwa-update__actions',
            ) ||
                !existing.querySelector('.lig-pwa-update__chip'))
        ) {
            existing.remove();
        }
        if (document.getElementById('lig-pwa-update')) return;

        const root = document.createElement('div');
        root.id = 'lig-pwa-update';
        root.className = 'lig-pwa-update';
        root.setAttribute('role', 'status');
        root.setAttribute('aria-live', 'polite');
        root.hidden = true;
        root.innerHTML =
            '<div class="lig-pwa-update__chip" aria-busy="true">' +
            '<div class="lig-pwa-update__progresso">' +
            '<div class="lig-pwa-update__topo">' +
            '<span class="lig-pwa-update__etapa" id="lig-pwa-update-etapa">Atualizando…</span>' +
            '<span class="lig-pwa-update__pct" id="lig-pwa-update-pct">0%</span>' +
            '</div>' +
            '<div class="lig-pwa-update__barra" aria-hidden="true">' +
            '<div class="lig-pwa-update__barra-fill" id="lig-pwa-update-fill" style="width:0%"></div>' +
            '</div>' +
            '</div>' +
            '</div>';

        document.body.appendChild(root);
    }

    function syncBanner() {
        ensureBanner();
        const root = document.getElementById('lig-pwa-update');
        if (!root) return;

        const aplicandoAgora = status === 'applying' || aplicando;
        const aguardando = status === 'waiting';
        const pendente = status === 'pending' || lerPersistido();
        const visivel = aplicandoAgora || aguardando || pendente;
        root.hidden = !visivel;
        document.body.classList.toggle('lig-pwa-update-open', visivel);
        root.classList.toggle('lig-pwa-update--waiting', aguardando && !aplicandoAgora);

        const etapaEl = document.getElementById('lig-pwa-update-etapa');
        const pctEl = document.getElementById('lig-pwa-update-pct');
        const fillEl = document.getElementById('lig-pwa-update-fill');
        const chip = root.querySelector('.lig-pwa-update__chip');
        const pct = Math.min(100, Math.max(0, Math.round(progresso)));
        const concluido = pct >= 100;

        if (aguardando && !aplicandoAgora) {
            if (etapaEl) etapaEl.textContent = 'Nova versão pronta — aplica ao terminar';
            if (pctEl) pctEl.textContent = '';
            if (fillEl) fillEl.style.width = '0%';
            if (chip) chip.setAttribute('aria-busy', 'false');
            return;
        }

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
            pendente: status === 'pending' || status === 'waiting' || lerPersistido(),
            progresso,
            etapa,
            ocupado: usuarioOcupado(),
        };
        window.dispatchEvent(new CustomEvent('lig-pwa-update', { detail }));
        for (const fn of listeners) fn(detail);
        syncBanner();
    }

    function definirStatus(next) {
        status = next;
        emitir();
        if (next === 'pending' || next === 'waiting') agendarAplicacaoAutomatica();
    }

    function agendarAplicacaoAutomatica() {
        if (aplicando) return;
        if (autoApplyTimer) window.clearTimeout(autoApplyTimer);
        autoApplyTimer = window.setTimeout(() => {
            autoApplyTimer = 0;
            void tentarAplicarComSeguranca();
        }, 400);
    }

    function tentarAplicarComSeguranca() {
        if (aplicando) return;
        if (!(status === 'pending' || status === 'waiting' || lerPersistido())) return;

        if (usuarioOcupado()) {
            if (status !== 'waiting') {
                status = 'waiting';
                progresso = 0;
                etapa = 'Aguardando…';
                emitir();
            } else {
                syncBanner();
            }
            autoApplyTimer = window.setTimeout(() => {
                autoApplyTimer = 0;
                void tentarAplicarComSeguranca();
            }, RETRY_MS);
            return;
        }

        void aplicar();
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

            const pendente = status === 'pending' || status === 'waiting' || lerPersistido();
            if (!silencioso) definirStatus(pendente ? 'pending' : 'idle');
            return pendente ? 'pendente' : 'em-dia';
        } catch {
            const pendente = status === 'pending' || status === 'waiting' || lerPersistido();
            if (!silencioso) definirStatus(pendente ? 'pending' : 'idle');
            return 'indisponivel';
        }
    }

    async function aplicar(opcoes) {
        const forcar = Boolean(opcoes?.forcar);
        if (aplicando) return;
        if (!forcar && usuarioOcupado()) {
            status = 'waiting';
            emitir();
            agendarAplicacaoAutomatica();
            return;
        }

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

            // Dupla checagem: se começou a digitar no meio do countdown, aborta.
            if (!forcar && usuarioOcupado()) {
                aplicando = false;
                persistirPendente(true);
                status = 'waiting';
                progresso = 0;
                emitir();
                agendarAplicacaoAutomatica();
                return;
            }

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
        if (started || isTotemPage()) return;
        started = true;
        bindActivityTracking();
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

        // Ao sair de um campo ou fechar overlay, tenta aplicar se houver update pendente.
        document.addEventListener(
            'focusout',
            () => {
                if (status === 'waiting' || status === 'pending' || lerPersistido()) {
                    window.setTimeout(() => agendarAplicacaoAutomatica(), 300);
                }
            },
            true,
        );

        void registrarSw().then(() => {
            window.setTimeout(() => void verificar({ silencioso: true }), 2000);

            const onVis = () => {
                if (document.visibilityState === 'visible') {
                    void verificar({ silencioso: true });
                }
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

    window.LigeirinhoPwaUpdate = {
        init,
        isPending: () =>
            status === 'pending' || status === 'waiting' || status === 'applying' || lerPersistido(),
        status: () => status,
        verificar,
        aplicar,
        usuarioOcupado,
        onStatusChange(fn) {
            listeners.add(fn);
            fn({
                status,
                pendente: status === 'pending' || status === 'waiting' || lerPersistido(),
                progresso,
                etapa,
                ocupado: usuarioOcupado(),
            });
            return () => listeners.delete(fn);
        },
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
