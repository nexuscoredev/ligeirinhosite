(function () {
    /**
     * Contexto único por unidade de totem.
     * storeKey === unitId (nunca login bruto) — evita conflito entre filiais/dispositivos.
     */
    const normalizeKey = (value) =>
        String(value || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '-');

    const featuresFromUnit = (unit = {}) => {
        const nested = unit.features && typeof unit.features === 'object' ? unit.features : {};
        return {
            doseWizard: Boolean(unit.doseWizardEnabled ?? nested.doseWizard),
            doseCategoryOnly: Boolean(unit.doseCategoryOnly ?? nested.doseCategoryOnly),
        };
    };

    const resolve = (session, totemConfig) => {
        const s = session || {};
        const map = totemConfig?.loginUnitMap || {};
        const login = String(s.login || '').trim();
        const mapped =
            map[login] ||
            map[login.toLowerCase()] ||
            map[String(s.email || '').trim()] ||
            null;
        const unitId = normalizeKey(s.totemUnitId || mapped || 'default') || 'default';
        const unit = totemConfig?.units?.[unitId] || totemConfig?.units?.default || {};
        const features =
            s.totemFeatures && typeof s.totemFeatures === 'object'
                ? {
                      doseWizard: Boolean(s.totemFeatures.doseWizard),
                      doseCategoryOnly: Boolean(s.totemFeatures.doseCategoryOnly),
                  }
                : featuresFromUnit(unit);

        return {
            unitId,
            storeKey: unitId,
            label: s.totemLabel || unit.label || login || 'Totem',
            features,
            unit,
            doseCategorySlugs: Array.isArray(unit.doseCategorySlugs) ? unit.doseCategorySlugs : [],
        };
    };

    const featureEnabled = (ctx, name) => Boolean(ctx?.features?.[name]);

    window.LigeirinhoTotemUnitContext = {
        resolve,
        featureEnabled,
        featuresFromUnit,
    };
})();
