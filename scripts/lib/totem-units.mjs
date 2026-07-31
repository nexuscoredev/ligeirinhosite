import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, '../../data/totem-units.json');

let cachedConfig = null;

export function loadTotemUnitsConfig() {
    if (cachedConfig) return cachedConfig;
    cachedConfig = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
    return cachedConfig;
}

export function totemLoginAllowlist() {
    const config = loadTotemUnitsConfig();
    const set = new Set(['totem', 'totem_device', 'totem-loja', 'totemloja']);
    for (const key of Object.keys(config.loginUnitMap || {})) {
        set.add(String(key).trim().toLowerCase());
    }
    return set;
}

export function isKnownTotemLogin(login) {
    const key = String(login || '').trim().toLowerCase();
    if (!key) return false;
    return totemLoginAllowlist().has(key);
}

/** Resolve unidade do totem — nunca mistura login com storeKey. */
export function resolveTotemUnitFromLogin(login, { totemUnitId } = {}) {
    const config = loadTotemUnitsConfig();
    const explicit = String(totemUnitId || '').trim();
    if (explicit && config.units?.[explicit]) {
        return { unitId: explicit, unit: config.units[explicit] };
    }

    const raw = String(login || '').trim();
    const mapped =
        config.loginUnitMap?.[raw] ||
        config.loginUnitMap?.[raw.toLowerCase()] ||
        null;
    const unitId = mapped || 'default';
    const unit = config.units?.[unitId] || config.units?.default || {};
    return { unitId, unit };
}

export function totemFeaturesForUnit(unit = {}) {
    const nested = unit.features && typeof unit.features === 'object' ? unit.features : {};
    return {
        doseWizard: Boolean(unit.doseWizardEnabled ?? nested.doseWizard),
        doseCategoryOnly: Boolean(unit.doseCategoryOnly ?? nested.doseCategoryOnly),
    };
}

export function enrichTotemProfile(profile, usuario) {
    if (!profile) return profile;
    const role = String(profile.role || '').toUpperCase();
    if (role !== 'TOTEM' && role !== 'TOTEM_DEVICE') return profile;

    const { unitId, unit } = resolveTotemUnitFromLogin(usuario?.login || profile.login, {
        totemUnitId: profile.totemUnitId,
    });
    return {
        ...profile,
        totemUnitId: unitId,
        totemLabel: unit.label || profile.totemLabel || profile.name || '',
        totemFeatures: totemFeaturesForUnit(unit),
    };
}
