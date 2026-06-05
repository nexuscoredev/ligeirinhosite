(function () {
    const THEME_KEY = 'ligeirinho-theme';
    const MODES = ['light', 'dark', 'auto'];

    try {
        const saved = localStorage.getItem(THEME_KEY);
        document.documentElement.setAttribute('data-theme', MODES.includes(saved) ? saved : 'auto');
    } catch {
        document.documentElement.setAttribute('data-theme', 'auto');
    }

    const resolveEffective = (mode) => {
        if (mode === 'dark') return 'dark';
        if (mode === 'light') return 'light';
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    };

    const updateMetaThemeColor = (effective) => {
        const color = effective === 'dark' ? '#121212' : '#ffffff';
        document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
            meta.content = color;
        });
        document.documentElement.classList.toggle('dark', effective === 'dark');
    };

    const apply = (mode) => {
        const next = MODES.includes(mode) ? mode : 'auto';
        document.documentElement.setAttribute('data-theme', next);
        try {
            localStorage.setItem(THEME_KEY, next);
        } catch {
            /* ignore */
        }
        updateMetaThemeColor(resolveEffective(next));
        window.dispatchEvent(new CustomEvent('ligeirinho-theme-changed', { detail: { mode: next } }));
    };

    const getMode = () => {
        const current = document.documentElement.getAttribute('data-theme');
        return MODES.includes(current) ? current : 'auto';
    };

    const getEffective = () => resolveEffective(getMode());

    const cycle = () => {
        const idx = MODES.indexOf(getMode());
        apply(MODES[(idx + 1) % MODES.length]);
    };

    const modeLabel = (mode) => {
        if (mode === 'light') return 'Claro';
        if (mode === 'dark') return 'Escuro';
        return 'Automático';
    };

    updateMetaThemeColor(getEffective());

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (getMode() === 'auto') updateMetaThemeColor(getEffective());
    });

    window.LigeirinhoTheme = {
        THEME_KEY,
        MODES,
        getMode,
        getEffective,
        setMode: apply,
        cycle,
        modeLabel,
    };
})();
