const WEEKDAY_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const DAY_NAME_TO_INDEX = {
    domingo: 0,
    dom: 0,
    segunda: 1,
    seg: 1,
    terca: 2,
    terça: 2,
    ter: 2,
    quarta: 3,
    qua: 3,
    quinta: 4,
    qui: 4,
    sexta: 5,
    sex: 5,
    sabado: 6,
    sábado: 6,
    sab: 6,
};

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

export function parseWeekday(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) {
        const n = Math.trunc(value);
        return n >= 0 && n <= 6 ? n : null;
    }
    const raw = normalizeText(value);
    if (/^\d+$/.test(raw)) {
        const n = Number(raw);
        return n >= 0 && n <= 6 ? n : null;
    }
    return DAY_NAME_TO_INDEX[raw] ?? null;
}

export function normalizeDeliveryConfig(raw = {}) {
    if (!raw || typeof raw !== 'object') {
        return {
            weekdays: [2],
            cutoffHour: 14,
            timezone: 'America/Sao_Paulo',
            horizonWeeks: 12,
            maxDates: 8,
            slotLabel: 'Regular',
            fee: 0,
            feeLabel: 'Grátis',
            source: 'fallback',
        };
    }

    let weekdays = [];
    if (Array.isArray(raw.weekdays)) {
        weekdays = raw.weekdays.map(parseWeekday).filter((d) => d != null);
    } else if (Array.isArray(raw.dias)) {
        weekdays = raw.dias.map(parseWeekday).filter((d) => d != null);
    }

    const fee = Number(raw.fee ?? raw.taxa ?? 0);
    const feeLabel =
        raw.feeLabel ||
        raw.taxa_label ||
        (fee <= 0 ? 'Grátis' : fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

    return {
        weekdays: weekdays.length ? [...new Set(weekdays)].sort((a, b) => a - b) : [2],
        cutoffHour: Number.isFinite(Number(raw.cutoffHour ?? raw.corte_hora))
            ? Number(raw.cutoffHour ?? raw.corte_hora)
            : 14,
        timezone: String(raw.timezone || raw.fuso || 'America/Sao_Paulo'),
        horizonWeeks: Math.max(1, Math.min(52, Number(raw.horizonWeeks ?? raw.semanas ?? 12) || 12)),
        maxDates: Math.max(1, Math.min(30, Number(raw.maxDates ?? raw.max_datas ?? 8) || 8)),
        slotLabel: String(raw.slotLabel || raw.tipo || raw.label || 'Regular'),
        fee: Number.isFinite(fee) ? fee : 0,
        feeLabel: String(feeLabel),
        source: String(raw.source || 'config'),
    };
}

function partsInTimeZone(date, timeZone) {
    const d = date instanceof Date ? date : new Date(date);
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: 'numeric',
        hour12: false,
        weekday: 'short',
    });
    const parts = fmt.formatToParts(d);
    const get = (type) => parts.find((p) => p.type === type)?.value;
    const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return {
        year: Number(get('year')),
        month: Number(get('month')),
        day: Number(get('day')),
        hour: Number(get('hour')),
        weekday: weekdayMap[get('weekday')] ?? 0,
        iso: `${get('year')}-${get('month')}-${get('day')}`,
    };
}

function addDaysUtc(year, month, day, delta) {
    const d = new Date(Date.UTC(year, month - 1, day + delta));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function buildAvailableDates(configInput, now = new Date()) {
    const config = normalizeDeliveryConfig(configInput);
    const { timezone, weekdays, cutoffHour, horizonWeeks, maxDates, slotLabel, fee, feeLabel } = config;
    const allowed = new Set(weekdays);
    const today = partsInTimeZone(now, timezone);
    let cursor = { year: today.year, month: today.month, day: today.day };

    if (today.hour >= cutoffHour) {
        cursor = addDaysUtc(cursor.year, cursor.month, cursor.day, 1);
    }

    const maxScanDays = horizonWeeks * 7 + 7;
    const dates = [];

    for (let i = 0; i < maxScanDays && dates.length < maxDates; i += 1) {
        const probe = new Date(Date.UTC(cursor.year, cursor.month - 1, cursor.day + i));
        const parts = partsInTimeZone(probe, timezone);
        if (!allowed.has(parts.weekday)) continue;

        const monthIdx = parts.month - 1;
        dates.push({
            date: parts.iso,
            day: parts.day,
            month: MONTH_PT[monthIdx] || '',
            weekday: WEEKDAY_PT[parts.weekday] || '',
            weekdayShort: WEEKDAY_SHORT[parts.weekday] || '',
            type: slotLabel,
            fee,
            feeLabel,
        });
    }

    return { config, dates };
}

export function formatDeliveryDateLabel(isoDate, options = {}) {
    if (!isoDate) return '';
    const [y, m, d] = String(isoDate).split('-').map(Number);
    if (!y || !m || !d) return isoDate;
    const probe = new Date(Date.UTC(y, m - 1, d, 12));
    const tz = options.timezone || 'America/Sao_Paulo';
    const parts = partsInTimeZone(probe, tz);
    const monthIdx = parts.month - 1;
    const weekday = options.short ? WEEKDAY_SHORT[parts.weekday] : WEEKDAY_PT[parts.weekday];
    return `${weekday}, ${parts.day} ${MONTH_PT[monthIdx]}`;
}

export function isValidDeliveryDate(isoDate, configInput, now = new Date()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(isoDate || ''))) return false;
    const { dates } = buildAvailableDates(configInput, now);
    return dates.some((slot) => slot.date === isoDate);
}
