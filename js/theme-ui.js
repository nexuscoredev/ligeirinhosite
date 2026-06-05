(function () {
    const icons = { light: 'light_mode', dark: 'dark_mode', auto: 'brightness_auto' };

    const shortLabel = (mode, theme) => {
        if (mode === 'light') return 'Claro';
        if (mode === 'dark') return 'Escuro';
        return 'Auto';
    };

    const renderSegment = (container) => {
        const theme = window.LigeirinhoTheme;
        if (!theme || !container) return;

        const compact =
            container.dataset.themeCompact === 'true' || container.classList.contains('lig-theme-segment--compact');
        const labelFn = compact ? (mode) => shortLabel(mode, theme) : (mode) => theme.modeLabel(mode);

        container.innerHTML = theme.MODES.map((mode) => {
            const active = theme.getMode() === mode;
            return `<button type="button" class="lig-theme-segment__btn${active ? ' lig-theme-segment__btn--active' : ''}" data-theme-mode="${mode}" aria-pressed="${active ? 'true' : 'false'}" title="${theme.modeLabel(mode)}">
<span class="material-symbols-outlined lig-theme-segment__icon" aria-hidden="true">${icons[mode]}</span>
<span class="lig-theme-segment__label">${labelFn(mode)}</span>
</button>`;
        }).join('');

        container.querySelectorAll('[data-theme-mode]').forEach((btn) => {
            btn.addEventListener('click', () => theme.setMode(btn.dataset.themeMode));
        });
    };

    const renderAll = () => {
        document.querySelectorAll('[data-lig-theme-mount]').forEach((el) => renderSegment(el));
    };

    window.LigeirinhoThemeUI = { renderSegment, renderAll };

    window.addEventListener('ligeirinho-theme-changed', renderAll);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderAll);
    } else {
        renderAll();
    }
})();
