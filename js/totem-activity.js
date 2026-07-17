(function () {
    const THROTTLE_MS = 400;

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
        const events = ['pointerdown', 'touchstart', 'keydown', 'click', 'wheel'];
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
        const idleMs = Math.max(1000, Number(opts.idleBeforeCountdownMs) || 20000);
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
        createCountdownTimeout,
        createIdleTimer,
    };
})();
