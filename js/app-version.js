(function () {
    const TYPE_LABELS = {
        feat: 'Novo',
        fix: 'Correção',
        perf: 'Performance',
        docs: 'Docs',
    };

    let cache = null;

    const load = async () => {
        if (cache) return cache;
        const [manifest, timeline] = await Promise.all([
            fetch('data/version/manifest.json')
                .then((r) => (r.ok ? r.json() : null))
                .catch(() => null),
            fetch('data/version/timeline.json')
                .then((r) => (r.ok ? r.json() : []))
                .catch(() => []),
        ]);
        cache = {
            manifest: manifest || { app: { version: '0.0.0', name: 'Ligeirinho App' }, modules: {} },
            timeline: Array.isArray(timeline) ? timeline : [],
        };
        return cache;
    };

    const formatDate = (iso) => {
        try {
            return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
            });
        } catch {
            return iso;
        }
    };

    const moduleLabel = (manifest, id) => manifest.modules?.[id]?.label || id;

    const renderFooterBadge = (root, data) => {
        if (!root || !data?.manifest?.app) return;
        const v = data.manifest.app.version;
        root.innerHTML = `<a href="versao.html" class="lig-version-link" title="Histórico de versões">v${v}</a>`;
    };

    const renderVersionPage = (root, data) => {
        if (!root || !data) return;
        const { manifest, timeline } = data;
        const app = manifest.app;

        const modulesHtml = Object.entries(manifest.modules || {})
            .map(
                ([id, mod]) => `<li class="lig-version-module">
<span class="lig-version-module__id">${id}</span>
<div>
<strong class="lig-version-module__name">${mod.label}</strong>
<span class="lig-version-module__ver">v${mod.version}</span>
<p class="lig-version-module__desc">${mod.description || ''}</p>
</div>
</li>`
            )
            .join('');

        const timelineHtml = timeline
            .map((release) => {
                const changesHtml = (release.changes || [])
                    .map((c) => {
                        const type = TYPE_LABELS[c.type] || c.type;
                        const mod = moduleLabel(manifest, c.module);
                        return `<li class="lig-version-change lig-version-change--${c.type || 'feat'}">
<span class="lig-version-change__meta">${formatDate(release.date)} · ${mod} · ${type}</span>
<span class="lig-version-change__text">${c.text}</span>
</li>`;
                    })
                    .join('');
                return `<article class="lig-version-release">
<header class="lig-version-release__head">
<p class="lig-version-release__date">${formatDate(release.date)}</p>
<h2 class="lig-version-release__title">${release.title}</h2>
<p class="lig-version-release__ver">App v${release.appVersion}</p>
<p class="lig-version-release__summary">${release.summary || ''}</p>
</header>
<ul class="lig-version-change-list">${changesHtml}</ul>
</article>`;
            })
            .join('');

        root.innerHTML = `<div class="lig-version-hero">
<p class="lig-version-hero__label">Versão atual</p>
<h1 class="lig-version-hero__title">${app.name} <span class="lig-version-hero__ver">v${app.version}</span></h1>
<p class="lig-version-hero__sub">${app.codename ? `Codinome ${app.codename} · ` : ''}Canal ${app.channel || 'stable'} · ${formatDate(app.releasedAt)}</p>
</div>
<section class="lig-version-section" aria-labelledby="lig-version-modules-title">
<h2 id="lig-version-modules-title" class="lig-version-section__title">Módulos</h2>
<ul class="lig-version-modules">${modulesHtml}</ul>
</section>
<section class="lig-version-section" aria-labelledby="lig-version-timeline-title">
<h2 id="lig-version-timeline-title" class="lig-version-section__title">Linha do tempo</h2>
<div class="lig-version-timeline">${timelineHtml}</div>
</section>`;
    };

    const init = async () => {
        const data = await load();
        renderFooterBadge(document.getElementById('lig-app-version'), data);
        renderVersionPage(document.getElementById('app-version-root'), data);
        window.dispatchEvent(new CustomEvent('ligeirinho-version-ready', { detail: data }));
        return data;
    };

    window.LigeirinhoVersion = {
        load,
        init,
        formatDate,
        get current() {
            return cache?.manifest?.app?.version || null;
        },
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => init(), { once: true });
    } else {
        init();
    }
})();
