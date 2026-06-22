(function () {
    const root = document.documentElement;
    if (!root.classList.contains('totem-kiosk')) return;

    const apply = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const short = Math.min(w, h);
        const long = Math.max(w, h);
        const landscape = w > h;
        const kiosk = landscape && long >= 1100;

        root.classList.toggle('totem--landscape', landscape);
        root.classList.toggle('totem--portrait', !landscape);
        root.classList.toggle('totem--phone', short < 600);
        root.classList.toggle('totem--tablet', short >= 600 && !kiosk);
        root.classList.toggle('totem--kiosk', kiosk);
        root.classList.toggle('totem--short', h < 520);
        root.classList.toggle('totem--tall', h >= 800);
        root.dataset.totemViewport = `${landscape ? 'landscape' : 'portrait'}-${short < 600 ? 'phone' : kiosk ? 'kiosk' : 'tablet'}`;
    };

    apply();
    window.addEventListener('resize', apply, { passive: true });
    window.addEventListener('orientationchange', () => window.setTimeout(apply, 120));
})();
