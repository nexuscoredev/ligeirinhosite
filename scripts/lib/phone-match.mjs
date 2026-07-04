export function normalizePhoneDigits(value) {
    return String(value || '').replace(/\D/g, '');
}

export function phoneLocalDigits(value) {
    const digits = normalizePhoneDigits(value);
    return digits.length >= 10 ? digits.slice(-11) : '';
}

export function phonesMatch(storedPhone, queryDigits) {
    const stored = normalizePhoneDigits(storedPhone);
    const query = normalizePhoneDigits(queryDigits);
    if (!stored || !query) return false;
    const storedLocal = stored.slice(-11);
    const queryLocal = query.slice(-11);
    if (storedLocal === queryLocal) return true;
    if (stored.slice(-10) === queryLocal.slice(-10)) return true;
    if (query.length >= 10 && stored.endsWith(queryLocal.slice(-10))) return true;
    return false;
}

export function phoneLookupSuffixes(digits) {
    const local = phoneLocalDigits(digits);
    if (!local) return [];
    return [...new Set([local, local.slice(-10), local.slice(-9), local.slice(-8)])].filter(
        (s) => s.length >= 8,
    );
}
