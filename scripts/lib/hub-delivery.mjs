import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { hubConfig } from '../hub-auth.mjs';
import { normalizeDeliveryConfig, buildAvailableDates } from './delivery-schedule.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FALLBACK_PATH = join(__dirname, '../../data/delivery-schedule.json');

function hubHeaders(key) {
    return {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
    };
}

function loadFallbackConfig() {
    try {
        const raw = JSON.parse(readFileSync(FALLBACK_PATH, 'utf8'));
        return normalizeDeliveryConfig({ ...raw, source: raw.source || 'fallback' });
    } catch {
        return normalizeDeliveryConfig({});
    }
}

function normalizeDiasEntregaRows(rows) {
    const active = rows.filter((row) => row.ativo !== false && row.active !== false);
    const weekdays = active
        .map((row) => {
            if (row.dia_semana != null) return Number(row.dia_semana);
            if (row.weekday != null) return Number(row.weekday);
            if (row.dia != null) return Number(row.dia);
            return null;
        })
        .filter((d) => Number.isFinite(d) && d >= 0 && d <= 6);

    const first = active[0] || {};
    return normalizeDeliveryConfig({
        weekdays: weekdays.length ? weekdays : undefined,
        cutoffHour: first.corte_hora ?? first.cutoff_hour ?? first.cutoffHour,
        horizonWeeks: first.semanas ?? first.horizon_weeks ?? first.horizonWeeks,
        maxDates: first.max_datas ?? first.max_dates ?? first.maxDates,
        slotLabel: first.tipo ?? first.label ?? first.slot_label,
        fee: first.taxa ?? first.fee,
        feeLabel: first.taxa_label ?? first.fee_label ?? first.feeLabel,
        timezone: first.timezone ?? first.fuso,
        source: 'hub:dias_entrega',
    });
}

function normalizeConfigRow(row) {
    const payload = row.valor ?? row.value ?? row.config ?? row.data ?? row;
    if (typeof payload === 'string') {
        try {
            return normalizeDeliveryConfig({ ...JSON.parse(payload), source: 'hub:config' });
        } catch {
            return null;
        }
    }
    if (payload && typeof payload === 'object') {
        return normalizeDeliveryConfig({ ...payload, source: 'hub:config' });
    }
    return null;
}

async function fetchTable(config, table, select = '*') {
    const token = config.serviceKey || config.anonKey;
    const url = `${config.url}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=50`;
    const res = await fetch(url, { headers: hubHeaders(token) });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return Array.isArray(data) && data.length ? data : null;
}

async function fetchFromHub(env) {
    const config = hubConfig(env);
    if (!config.url) return null;

    const diasRows = await fetchTable(config, 'dias_entrega');
    if (diasRows?.length) return normalizeDiasEntregaRows(diasRows);

    const altRows = await fetchTable(config, 'entrega_dias');
    if (altRows?.length) return normalizeDiasEntregaRows(altRows);

    for (const table of ['configuracoes', 'configuracao_entrega', 'app_settings']) {
        const rows = await fetchTable(config, table);
        if (!rows?.length) continue;
        const match =
            rows.find((r) =>
                ['entrega_parceiros', 'dias_entrega', 'delivery_schedule', 'entrega'].includes(
                    String(r.chave || r.key || r.slug || '').toLowerCase()
                )
            ) || rows[0];
        const normalized = normalizeConfigRow(match);
        if (normalized) return normalized;
    }

    return null;
}

export async function getDeliverySchedule(env = process.env) {
    const hubConfigRow = await fetchFromHub(env).catch(() => null);
    const config = hubConfigRow || loadFallbackConfig();
    const built = buildAvailableDates(config);
    return {
        source: config.source,
        config: built.config,
        dates: built.dates,
    };
}
