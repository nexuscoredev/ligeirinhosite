(function () {
    const THROTTLE_MS = 400;
    const GHOST_CLICK_MS = 520;
    const TAP_MAX_MOVE_PX = 16;
    const TAP_MAX_MS = 750;
    const TAP_DEDUPE_MS = 420;
    let ghostClickUntil = 0;
    let ghostCaptureBound = false;
    let shieldTimer = null;
    let shieldEl = null;
    let lastTapKey = '';
    let lastTapAt = 0;

    const ensureTouchShield = () => {
        if (shieldEl?.isConnected) return shieldEl;
        if (typeof document === 'undefined' || !document.body) return null;
        shieldEl = document.createElement('div');
        shieldEl.id = 'totem-touch-shield';
        shieldEl.className = 'totem-touch-shield';
        shieldEl.setAttribute('aria-hidden', 'true');
        document.body.appendChild(shieldEl);
        return shieldEl;
    };

    const hideTouchShield = () => {
        shieldEl?.classList.remove('totem-touch-shield--active');
    };

    const bindGhostCapture = () => {
        if (ghostCaptureBound || typeof document === 'undefined') return;
        ghostCaptureBound = true;
        const blockIfSuppressed = (e) => {
            if (Date.now() >= ghostClickUntil) return;
            e.preventDefault();
            e.stopImmediatePropagation();
        };
        ['click', 'pointerdown', 'pointerup', 'touchstart', 'touchend'].forEach((evt) => {
            document.addEventListener(evt, blockIfSuppressed, { capture: true, passive: false });
        });
    };

    const suppressGhostClicks = (ms = GHOST_CLICK_MS) => {
        ghostClickUntil = Date.now() + Math.max(120, Number(ms) || GHOST_CLICK_MS);
        bindGhostCapture();
        const shield = ensureTouchShield();
        if (shield) {
            shield.classList.add('totem-touch-shield--active');
            window.clearTimeout(shieldTimer);
            shieldTimer = window.setTimeout(hideTouchShield, Math.max(120, Number(ms) || GHOST_CLICK_MS));
        }
    };

    const isGhostClickSuppressed = () => Date.now() < ghostClickUntil;

    const guardGhostClick = (e) => {
        if (!isGhostClickSuppressed()) return false;
        e.preventDefault();
        e.stopPropagation();
        return true;
    };

    const isDuplicateTap = (x, y) => {
        const key = `${Math.round(Number(x) / 10)}:${Math.round(Number(y) / 10)}`;
        const now = Date.now();
        if (key === lastTapKey && now - lastTapAt < TAP_DEDUPE_MS) return true;
        lastTapKey = key;
        lastTapAt = now;
        return false;
    };

    /**
     * Toque validado para monitores touch: pointerdown→pointerup, pouco movimento, sem ghost/dedupe.
     * Preferir em grades e botoes do catalogo (evita click fantasma pos-modal).
     */
    const bindPointerTap = (root, handler) => {
        if (!root || typeof handler !== 'function') return () => {};
        /** @type {Map<number, { x: number, y: number, t: number }>} */
        const active = new Map();

        const onPointerDown = (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            if (isGhostClickSuppressed()) {
                e.preventDefault();
                return;
            }
            active.set(e.pointerId, { x: e.clientX, y: e.clientY, t: Date.now() });
        };

        const onPointerUp = (e) => {
            const start = active.get(e.pointerId);
            active.delete(e.pointerId);
            if (!start) return;
            if (isGhostClickSuppressed()) {
                e.preventDefault();
                return;
            }
            const dx = Math.abs(e.clientX - start.x);
            const dy = Math.abs(e.clientY - start.y);
            if (dx > TAP_MAX_MOVE_PX || dy > TAP_MAX_MOVE_PX) return;
            if (Date.now() - start.t > TAP_MAX_MS) return;
            if (isDuplicateTap(e.clientX, e.clientY)) {
                e.preventDefault();
                return;
            }
            handler(e);
        };

        const onPointerCancel = (e) => {
            active.delete(e.pointerId);
        };

        root.addEventListener('pointerdown', onPointerDown, { passive: false });
        root.addEventListener('pointerup', onPointerUp, { passive: false });
        root.addEventListener('pointercancel', onPointerCancel, { passive: true });
        root.addEventListener('pointerleave', onPointerCancel, { passive: true });

        return () => {
            root.removeEventListener('pointerdown', onPointerDown);
            root.removeEventListener('pointerup', onPointerUp);
            root.removeEventListener('pointercancel', onPointerCancel);
            root.removeEventListener('pointerleave', onPointerCancel);
        };
    };

    const bump = (fn) => {
        if (typeof fn !== 'function') return;
        const now = Date.now();
        if (fn._totemLastBump && now - fn._totemLastBump < THROTTLE_MS) return;
        fn._totemLastBump = now;
        fn();
    };

    const bind = (fn, root = document) => {
        if (!fn || !root?.addEventListener) return () => {};
        const handler = () => bump(fn);
        const events = ['pointerdown', 'touchstart', 'keydown', 'wheel'];
        events.forEach((evt) => root.addEventListener(evt, handler, { passive: true }));
        root.addEventListener('touchmove', handler, { passive: true });
        return () => {
            events.forEach((evt) => root.removeEventListener(evt, handler));
            root.removeEventListener('touchmove', handler);
        };
    };

    const bindScroll = (fn, ...roots) => {
        if (!fn) return () => {};
        const handler = () => bump(fn);
        const targets = roots.filter(Boolean);
        targets.forEach((el) => el.addEventListener('scroll', handler, { passive: true }));
        return () => targets.forEach((el) => el.removeEventListener('scroll', handler));
    };

    /**
     * Inatividade → contagem regressiva → callback.
     * bump()/arm() reinicia a fase de espera (sem contagem visível).
     */
    const createCountdownTimeout = (opts = {}) => {
        const idleMs = Math.max(1000, Number(opts.idleBeforeCountdownMs) || 35000);
        const countdownMs = Math.max(1000, Number(opts.countdownMs) || 10000);
        let idleTimer = null;
        let countdownTimer = null;
        let tickTimer = null;
        let inCountdown = false;

        const clearAll = () => {
            clearTimeout(idleTimer);
            clearTimeout(countdownTimer);
            clearInterval(tickTimer);
            idleTimer = null;
            countdownTimer = null;
            tickTimer = null;
            inCountdown = false;
        };

        const cancel = () => {
            clearAll();
            opts.onReset?.();
        };

        const startCountdown = () => {
            if (typeof opts.canStartCountdown === 'function' && !opts.canStartCountdown()) {
                idleTimer = window.setTimeout(startCountdown, 5000);
                return;
            }
            inCountdown = true;
            opts.onCountdownStart?.();
            let remaining = Math.ceil(countdownMs / 1000);
            opts.onTick?.(remaining);
            tickTimer = window.setInterval(() => {
                remaining -= 1;
                opts.onTick?.(remaining);
                if (remaining <= 0) {
                    clearInterval(tickTimer);
                    tickTimer = null;
                }
            }, 1000);
            countdownTimer = window.setTimeout(() => {
                clearInterval(tickTimer);
                tickTimer = null;
                inCountdown = false;
                opts.onComplete?.();
            }, countdownMs);
        };

        const arm = () => {
            clearAll();
            opts.onReset?.();
            idleTimer = window.setTimeout(startCountdown, idleMs);
        };

        return { arm, bump: arm, cancel, isCountdown: () => inCountdown };
    };

    /** @deprecated use createCountdownTimeout */
    const createIdleTimer = (callback, ms) => {
        return createCountdownTimeout({
            idleBeforeCountdownMs: 0,
            countdownMs: ms,
            onComplete: callback,
        });
    };

    window.LigeirinhoTotemActivity = {
        bump,
        bind,
        bindScroll,
        bindPointerTap,
        createCountdownTimeout,
        createIdleTimer,
        suppressGhostClicks,
        isGhostClickSuppressed,
        guardGhostClick,
    };

    bindGhostCapture();
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => ensureTouchShield(), { once: true });
        } else {
            ensureTouchShield();
        }
    }
})();
