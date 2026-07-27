/**
 * Fallback/legado — a intro no login roda inline no index.html
 * (CSS autoplay + dismiss) para evitar travamento inicial.
 */
(function () {
    var el = document.getElementById('lig-splash');
    if (!el) {
        document.documentElement.classList.add('lig-splash-done');
        document.documentElement.classList.remove('lig-splash-active');
        window.dispatchEvent(new Event('lig-splash-done'));
        return;
    }

    var reduce =
        window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var finished = false;
    var INTRO_MS = reduce ? 280 : 2350;
    var FADE_MS = reduce ? 160 : 500;

    document.documentElement.classList.add('lig-splash-active');

    function cleanup() {
        if (el && el.parentNode) el.parentNode.removeChild(el);
        document.documentElement.classList.remove('lig-splash-active');
        document.documentElement.classList.add('lig-splash-done');
        window.dispatchEvent(new Event('lig-splash-done'));
    }

    function finish() {
        if (finished) return;
        finished = true;
        el.classList.add('lig-splash--out');
        window.setTimeout(cleanup, FADE_MS + 30);
    }

    window.setTimeout(finish, INTRO_MS);
    window.setTimeout(finish, INTRO_MS + 1500);
})();
