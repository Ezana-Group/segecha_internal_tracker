export const validators = {
    required: (v) => (v && String(v).trim() !== '' ? null : 'This field is required'),

    email: (v) => {
        if (v == null || String(v).trim() === '') return null;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim())
            ? null
            : 'Enter a valid email address';
    },

    kenyaPhone: (v) => {
        const clean = String(v).replace(/\s+/g, '');
        return /^(\+254|0)7\d{8}$/.test(clean) ? null : 'Enter a valid Kenyan phone number (e.g. 0712 345678)';
    },

    mpesa: (v) => {
        const clean = String(v).replace(/\s+/g, '');
        return /^07\d{8}$/.test(clean) ? null : 'M-Pesa number must be in format 07XXXXXXXX';
    },

    nationalId8: (v) => {
        const clean = String(v || "").trim();
        if (!clean) return null;
        return /^\d{8}$/.test(clean) ? null : "National ID must be exactly 8 digits";
    },

    kraPin: (v) => {
        const clean = String(v || "").trim().toUpperCase();
        if (!clean) return null;
        return /^[A-Z]\d{9}[A-Z]$/.test(clean) ? null : "KRA PIN must match format A123456789Z";
    },

    truckReg: (v) => {
        return /^[A-Z]{3}\s\d{3}[A-Z]$/.test(String(v).toUpperCase()) ? null : 'Format must be KCB 100A';
    },

    psvLicence: (v) => {
        return /^PSV\/LIC\/\d{4}\/\d{5}$/.test(String(v)) ? null : 'Format must be PSV/LIC/YYYY/NNNNN';
    },

    positiveNumber: (v) => {
        return v && Number(v) > 0 ? null : 'Must be a number greater than zero';
    },

    /** Numeric field required; allows 0 (e.g. journey revenue on empty return). */
    nonNegativeNumber: (v) => {
        if (v === '' || v === null || v === undefined) return 'This field is required';
        const n = Number(v);
        if (Number.isNaN(n)) return 'Must be a valid number';
        return n >= 0 ? null : 'Must be zero or greater';
    },

    dateOrder: (start, end) => {
        return !end || !start || new Date(end) >= new Date(start)
            ? null
            : 'End date cannot be before start date';
    },
};

// Run multiple validators and return first error
export const validate = (value, ...rules) => {
    for (const rule of rules) {
        const error = rule(value);
        if (error) return error;
    }
    return null;
};
