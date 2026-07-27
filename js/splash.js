/**
 * Intro de abertura estilo Zé Delivery: zoom suave no logo, sem jank.
 * Só anima transform/opacity (GPU). Dispara `lig-splash-done` ao terminar.
 */
(function () {
    var el = document.getElementById('lig-splash');
    if (!el) {
        document.documentElement.classList.add('lig-splash-done');
        window.dispatchEvent(new Event('lig-splash-done'));
        return;
    }

    var logo = el.querySelector('.lig-splash__logo');
    var reduce =
        window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var finished = false;
    var INTRO_MS = reduce ? 350 : 2100;
    var FADE_MS = reduce ? 200 : 560;

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
        window.setTimeout(cleanup, FADE_MS + 40);
    }

    function play() {
        if (finished) return;
        if (!reduce) el.classList.add('lig-splash--play');
        window.setTimeout(finish, INTRO_MS);
    }

    function whenReady(cb) {
        var start = function () {
            window.requestAnimationFrame(function () {
                window.requestAnimationFrame(cb);
            });
        };
        if (!logo) {
            start();
            return;
        }
        if (logo.complete && logo.naturalWidth > 0) {
            start();
            return;
        }
        var done = false;
        var go = function () {
            if (done) return;
            done = true;
            start();
        };
        logo.addEventListener('load', go, { once: true });
        logo.addEventListener('error', go, { once: true });
        window.setTimeout(go, 900);
    }

    whenReady(play);
    window.setTimeout(finish, INTRO_MS + 1800);
})();
