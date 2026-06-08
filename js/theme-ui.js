(function () {
    const icons = { light: 'light_mode', dark: 'dark_mode', auto: 'brightness_auto' };

    const renderToggle = (container) => {
        const theme = window.LigeirinhoTheme;
        if (!theme || !container) return;

        const mode = theme.getMode();
        const label = theme.modeLabel(mode);

        container.innerHTML = `<button type="button" class="lig-theme-toggle" aria-label="Tema: ${label}. Clique para alternar." title="${label}">
<span class="material-symbols-outlined lig-theme-toggle__icon" aria-hidden="true">${icons[mode]}</span>
</button>`;

        container.querySelector('.lig-theme-toggle')?.addEventListener('click', () => theme.cycle());
    };

    const renderAll = () => {
        document.querySelectorAll('[data-lig-theme-mount]').forEach((el) => renderToggle(el));
    };

    window.LigeirinhoThemeUI = { renderToggle, renderAll };

    window.addEventListener('ligeirinho-theme-changed', renderAll);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderAll);
    } else {
        renderAll();
    }
})();
