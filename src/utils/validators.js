export const validators = {
    required: (v) => (v && String(v).trim() !== '' ? null : 'This field is required'),

    email: (v) => {
        if (v == null || String(v).trim() === '') return null;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim())
            ? null
            : 'Enter a valid email address';
    },

    phone: (v) => {
        if (!v) return null;
        const clean = String(v).replace(/\s+/g, '');
        // Generic phone validator: must start with + or 0, and have 7-15 digits
        return /^(\+|0)\d{7,15}$/.test(clean) ? null : 'Enter a valid phone number (e.g. +254712345678)';
    },

    kenyaPhone: (v) => {
        const clean = String(v).replace(/\s+/g, '');
        return /^(\+254|0)7\d{8}$/.test(clean) ? null : 'Enter a valid Kenyan phone number (e.g. 0712 345678)';
    },

    mpesa: (v) => {
        const clean = String(v).replace(/\s+/g, '');
        return /^07\d{8}$/.test(clean) ? null : 'M-Pesa number must be in format 07XXXXXXXX';
    },

    truckReg: (v) => {
        return /^[A-Z]{3}\s\d{3}[A-Z]$/.test(String(v).toUpperCase()) ? null : 'Format must be KCB 100A';
    },

    psvLicence: (v) => {
        return /^PSV\/LIC\/\d{4}\/\d{5}$/.test(String(v)) ? null : 'Format must be PSV/LIC/YYYY/NNNNN';
    },

    positiveNumber: (v, allowZero = false) => {
        const n = Number(v);
        if (allowZero && n === 0) return null;
        return v && n > 0 ? null : (allowZero ? 'Must be a number 0 or greater' : 'Must be a number greater than zero');
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
