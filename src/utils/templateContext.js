/**
 * Normalises message-template placeholder context so camelCase (UI/docs) and
 * legacy snake_case keys both work when filling templates.
 */
export function expandMessageTemplateContext(ctx = {}) {
    const c = { ...ctx };

    const mirror = (a, b) => {
        const av = c[a];
        const bv = c[b];
        if ((av === undefined || av === null || av === "") && bv != null && bv !== "") c[a] = bv;
        if ((bv === undefined || bv === null || bv === "") && av != null && av !== "") c[b] = av;
    };

    mirror("staffName", "staff_name");
    mirror("staffId", "staff_id");
    mirror("invoiceId", "invoice_id");
    mirror("customerName", "customer_name");
    mirror("dueDate", "due_date");
    mirror("journeyId", "journey_id");
    mirror("driverName", "driver_name");
    mirror("driverId", "driver_id");
    mirror("customerPhone", "customer_phone");
    mirror("customerEmail", "customer_email");
    mirror("mpesaRef", "mpesa_ref");
    mirror("businessName", "business_name");
    mirror("destination", "dest");
    mirror("verifyUrl", "verify_url");
    mirror("resetUrl", "reset_url");
    mirror("loginEmail", "login_email");

    return c;
}
