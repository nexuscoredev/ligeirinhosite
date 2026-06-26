(function () {
    const MOTION_TARGETS = [
        '.ze-product-card',
        '.ze-product-h',
        '.home-suggested-card',
        '.home-quick-chip',
        '.home-story',
        '.ze-cat-tile',
        '.ofertas-product-row',
        '.conta-menu-row',
        '.conta-user-card',
        '.caminhao-item',
        '.lig-page-card',
        '.ze-section__head',
    ];

    const SELECTOR = MOTION_TARGETS.join(',');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    let io;
    let mo;
    let debounceTimer;

    const staggerDelay = (el) => {
        const parent = el.parentElement;
        if (!parent) return 0;
        const index = [...parent.children].indexOf(el);
        if (index < 0) return 0;
        return Math.min(index, 14) * 45;
    };

    const reveal = (el) => {
        el.classList.add('lig-motion-visible');
        io?.unobserve(el);
    };

    const prepare = (el) => {
        if (el.dataset.ligMotion === '1') return false;
        el.dataset.ligMotion = '1';
        el.classList.add('lig-motion-item');
        el.style.setProperty('--lig-motion-delay', `${staggerDelay(el)}ms`);
        return true;
    };

    const scan = (root) => {
        const scope = root || document;
        const nodes = scope.querySelectorAll(SELECTOR);

        if (reducedMotion.matches) {
            nodes.forEach(reveal);
            return;
        }

        nodes.forEach((el) => {
            if (!prepare(el)) return;
            if (el.classList.contains('lig-motion-visible')) return;

            const rect = el.getBoundingClientRect();
            const inView = rect.top < window.innerHeight * 0.94 && rect.bottom > 0;
            if (inView) {
                window.requestAnimationFrame(() => reveal(el));
            } else if (io) {
                io.observe(el);
            }
        });
    };

    const bindMainObserver = () => {
        const main = document.getElementById('lig-page-main');
        if (!main || typeof MutationObserver === 'undefined') return;

        mo?.disconnect();
        mo = new MutationObserver(() => {
            clearTimeout(debounceTimer);
            debounceTimer = window.setTimeout(() => scan(main), 120);
        });
        mo.observe(main, { childList: true, subtree: true });
    };

    const init = () => {
        if (reducedMotion.matches) {
            document.documentElement.classList.add('lig-motion-reduced');
        } else {
            document.documentElement.classList.add('lig-motion-ready');
            io = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) reveal(entry.target);
                    });
                },
                { rootMargin: '0px 0px -8% 0px', threshold: 0.06 }
            );
        }

        scan(document);
        bindMainObserver();

        reducedMotion.addEventListener?.('change', () => {
            document.documentElement.classList.toggle('lig-motion-reduced', reducedMotion.matches);
            document.documentElement.classList.toggle('lig-motion-ready', !reducedMotion.matches);
            scan(document.getElementById('lig-page-main') || document);
        });
    };

    window.LigeirinhoMotion = {
        refresh: () => scan(document.getElementById('lig-page-main') || document),
        observe: scan,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
