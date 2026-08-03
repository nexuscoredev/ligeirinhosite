/**
 * Atualização PWA do Ligeirinho Parceiros — estável.
 *
 * - Baixa a versão nova em silêncio.
 * - Só aplica com SW `waiting` real (sem reload falso → evita tela branca em loop).
 * - Um único reload (controllerchange + fallback).
 * - Nunca no meio de pedido / formulário / digitação.
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'lig-parceiros-pwa-update-pending-v1';
    const RELOAD_GUARD_KEY = 'lig-parceiros-pwa-reload-guard-v1';
    const SW_URL = '/js/sw.js';
    const SW_SCOPE = '/';
    const IDLE_SAFE_MS = 20_000;
    const RETRY_MS = 12_000;
    const AWAY_APPLY_MS = 45_000;

    const CRITICAL_PAGES = new Set([
        'resumo',
        'resumo-pedido',
        'pagamento',
        'pix',
        'endereco',
        'conta',
        'caminhao',
    ]);

    const SAFE_PAGES = new Set([
        'inicio',
        'home',
        'pedidos',
        'ofertas',
        'promocoes',
        'quemsomos',
        'contato',
        'meus-pedidos',
        '',
    ]);

    /** @type {'idle' | 'pending' | 'waiting' | 'applying'} */
    let status = 'idle';
    let started = false;
    let aplicando = false;
    let reloadAgendado = false;
    let autoApplyTimer = 0;
    let progresso = 0;
    let etapa = 'Atualizando…';
    let lastActivityAt = Date.now();
    let hiddenSince = 0;
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

    function pageKey() {
        const fromBody = String(document.body?.dataset?.page || '').trim().toLowerCase();
        if (fromBody) return fromBody;
        const path = String(location.pathname || '').toLowerCase();
        if (path.includes('resumo-pedido')) return 'resumo-pedido';
        if (path.includes('pedido-confirmado')) return 'pedido-confirmado';
        if (path.includes('conta')) return 'conta';
        if (path.includes('totem')) return 'totem';
        return path.replace(/^\//, '').replace(/\.html$/, '') || 'inicio';
    }

    function fluxoCriticoAtivo() {
        const page = pageKey();
        if (CRITICAL_PAGES.has(page)) return true;
        if (new URLSearchParams(location.search).has('picker')) return true;
        if (document.querySelector('.resumo-shell--picker')) return true;

        const sheet = document.getElementById('cart-mobile-sheet');
        if (sheet && !sheet.classList.contains('hidden') && sheet.getAttribute('aria-hidden') !== 'true') {
            return true;
        }
        return false;
    }

    function paginaSeguraParaReload() {
        const page = pageKey();
        if (fluxoCriticoAtivo()) return false;
        if (SAFE_PAGES.has(page)) return true;
        // Catálogo / listagens: ok se não estiver digitando nem com modal.
        if (page === 'pedido-confirmado') return true;
        return !CRITICAL_PAGES.has(page);
    }

    function elementoEditavel(el) {
        if (!el || el === document.body || el === document.documentElement) return false;
        const tag = String(el.tagName || '').toUpperCase();
        if (tag === 'INPUT') {
            const type = String(el.type || 'text').toLowerCase();
            if (['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'hidden', 'image'].includes(type)) {
                return false;
            }
            return !el.disabled && !el.readOnly;
        }
        if (tag === 'TEXTAREA' || tag === 'SELECT') return !el.disabled && !el.readOnly;
        return Boolean(el.isContentEditable);
    }

    function overlayAberto() {
        if (document.body.classList.contains('lig-push-prompt-open')) return true;
        if (document.body.classList.contains('lig-install-modal-open')) return true;
        if (document.getElementById('lig-push-prompt')) return true;
        if (document.querySelector('.lig-promo-entry-notice--open')) return true;
        if (document.querySelector('[role="dialog"]:not([hidden]):not([aria-hidden="true"])')) return true;
        if (document.querySelector('dialog[open]')) return true;
        return false;
    }

    function podeAplicarAgora() {
        if (aplicando || reloadAgendado) return false;
        if (document.visibilityState === 'hidden') return false;
        if (!paginaSeguraParaReload()) return false;
        if (elementoEditavel(document.activeElement)) return false;
        if (overlayAberto()) return false;
        if (Date.now() - lastActivityAt < IDLE_SAFE_MS) return false;
        return true;
    }

    function bindActivityTracking() {
        if (activityBound) return;
        activityBound = true;
        const onAct = () => marcarAtividade();
        document.addEventListener('keydown', onAct, true);
        document.addEventListener('input', onAct, true);
        document.addEventListener('pointerdown', onAct, true);
        document.addEventListener('touchstart', onAct, { capture: true, passive: true });
        document.addEventListener(
            'focusin',
            (ev) => {
                if (elementoEditavel(ev.target)) marcarAtividade();
            },
            true,
        );
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
            (existing.querySelector('.lig-pwa-update__primary, .lig-pwa-update__actions') ||
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
        root.hidden = !aplicandoAgora;
        document.body.classList.toggle('lig-pwa-update-open', aplicandoAgora);

        if (!aplicandoAgora) return;

        const etapaEl = document.getElementById('lig-pwa-update-etapa');
        const pctEl = document.getElementById('lig-pwa-update-pct');
        const fillEl = document.getElementById('lig-pwa-update-fill');
        const pct = Math.min(100, Math.max(0, Math.round(progresso)));
        if (etapaEl) etapaEl.textContent = pct >= 100 ? 'Atualizado' : etapa || 'Atualizando…';
        if (pctEl) pctEl.textContent = pct + '%';
        if (fillEl) fillEl.style.width = pct + '%';
    }

    function emitir() {
        const detail = {
            status,
            pendente: status === 'pending' || status === 'waiting' || lerPersistido(),
            progresso,
            etapa,
        };
        window.dispatchEvent(new CustomEvent('lig-pwa-update', { detail }));
        for (const fn of listeners) fn(detail);
        syncBanner();
    }

    function definirStatus(next) {
        status = next;
        emitir();
        if (next === 'pending' || next === 'waiting') agendarAplicacaoAutomatica(900);
    }

    function agendarAplicacaoAutomatica(delayMs) {
        if (aplicando || reloadAgendado) return;
        if (autoApplyTimer) window.clearTimeout(autoApplyTimer);
        autoApplyTimer = window.setTimeout(() => {
            autoApplyTimer = 0;
            void tentarAplicarComSeguranca();
        }, delayMs == null ? 900 : delayMs);
    }

    function tentarAplicarComSeguranca() {
        if (aplicando || reloadAgendado) return;
        if (!(status === 'pending' || status === 'waiting' || lerPersistido())) return;

        if (!podeAplicarAgora()) {
            if (status !== 'waiting') {
                status = 'waiting';
                emitir();
            }
            agendarAplicacaoAutomatica(RETRY_MS);
            return;
        }

        void aplicar();
    }

    function sinalizarPendente() {
        persistirPendente(true);
        definirStatus(fluxoCriticoAtivo() ? 'waiting' : 'pending');
    }

    async function getRegistration() {
        if (!('serviceWorker' in navigator)) return null;
        lastRegistration = lastRegistration ?? (await navigator.serviceWorker.getRegistration(SW_SCOPE));
        return lastRegistration;
    }

    async function temSwWaiting() {
        const reg = await getRegistration();
        return Boolean(reg?.waiting && navigator.serviceWorker.controller);
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
            if (await temSwWaiting()) sinalizarPendente();
            return reg;
        } catch {
            return null;
        }
    }

    async function verificar(opcoes) {
        const silencioso = opcoes?.silencioso ?? true;
        if (!('serviceWorker' in navigator) || aplicando) return 'indisponivel';
        try {
            const reg = await getRegistration();
            if (!reg) return 'indisponivel';
            await reg.update();
            if (await temSwWaiting()) {
                sinalizarPendente();
                return 'pendente';
            }
            if (lerPersistido() || status === 'pending' || status === 'waiting') {
                // Falso positivo: limpa sem reload (evita loop de tela branca).
                persistirPendente(false);
                status = 'idle';
                if (!silencioso) emitir();
            }
            return 'em-dia';
        } catch {
            return 'indisponivel';
        }
    }

    function recarregarUmaVez() {
        if (reloadAgendado) return;
        reloadAgendado = true;
        try {
            sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
        } catch {
            /* ignore */
        }
        reportarProgresso(100, 'Pronto');
        // Replace evita empilhar histórico quebrado após claim do SW.
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

        if (!(await temSwWaiting())) {
            persistirPendente(false);
            status = 'idle';
            progresso = 0;
            emitir();
            return;
        }

        if (!podeAplicarAgora()) {
            status = 'waiting';
            emitir();
            agendarAplicacaoAutomatica(RETRY_MS);
            return;
        }

        aplicando = true;
        if (autoApplyTimer) {
            window.clearTimeout(autoApplyTimer);
            autoApplyTimer = 0;
        }
        persistirPendente(false);
        status = 'applying';
        reportarProgresso(8, 'Iniciando…');
        emitir();

        try {
            try {
                document.activeElement?.blur?.();
            } catch {
                /* ignore */
            }

            reportarProgresso(30, 'Preparando…');
            await new Promise((r) => window.setTimeout(r, 50));

            if (!(await temSwWaiting())) {
                aplicando = false;
                status = 'idle';
                progresso = 0;
                emitir();
                return;
            }

            if (!podeAplicarAgora()) {
                aplicando = false;
                persistirPendente(true);
                status = 'waiting';
                progresso = 0;
                emitir();
                agendarAplicacaoAutomatica(RETRY_MS);
                return;
            }

            reportarProgresso(55, 'Ativando…');
            const reg = await getRegistration();
            reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });

            reportarProgresso(80, 'Aplicando…');
            // Fallback se controllerchange não disparar (alguns WebViews).
            window.setTimeout(() => {
                if (!reloadAgendado) recarregarUmaVez();
            }, 1800);
        } catch {
            aplicando = false;
            persistirPendente(true);
            status = 'pending';
            progresso = 0;
            emitir();
            agendarAplicacaoAutomatica(RETRY_MS);
        }
    }

    function init() {
        if (started || isTotemPage()) return;
        started = true;
        bindActivityTracking();
        ensureBanner();

        // Proteção: se o último reload foi há < 8s e a página está “vazia”, não force outro update.
        try {
            const lastReload = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
            if (lastReload && Date.now() - lastReload < 8000) {
                persistirPendente(false);
                sessionStorage.removeItem(RELOAD_GUARD_KEY);
            }
        } catch {
            /* ignore */
        }

        if (lerPersistido()) definirStatus(fluxoCriticoAtivo() ? 'waiting' : 'pending');

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!aplicando) return;
                persistirPendente(false);
                recarregarUmaVez();
            });
        }

        void registrarSw().then(() => {
            window.setTimeout(() => void verificar({ silencioso: true }), 4000);

            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') {
                    hiddenSince = Date.now();
                    return;
                }
                const away = hiddenSince ? Date.now() - hiddenSince : 0;
                hiddenSince = 0;
                void verificar({ silencioso: true }).then(() => {
                    if (away >= AWAY_APPLY_MS) agendarAplicacaoAutomatica(1500);
                });
            });

            const id = window.setInterval(() => {
                void verificar({ silencioso: true }).then((r) => {
                    if (r === 'pendente') tentarAplicarComSeguranca();
                });
            }, 45_000);

            window.addEventListener(
                'beforeunload',
                () => {
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
        usuarioOcupado: () => !podeAplicarAgora(),
        fluxoCriticoAtivo,
        onStatusChange(fn) {
            listeners.add(fn);
            fn({
                status,
                pendente: status === 'pending' || status === 'waiting' || lerPersistido(),
                progresso,
                etapa,
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
