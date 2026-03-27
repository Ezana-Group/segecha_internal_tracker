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
    mirror("invoiceUrl", "invoice_url");
    mirror("paymentUrl", "payment_url");
    mirror("amountDue", "amount_due");
    mirror("invoiceStatus", "invoice_status");
    mirror("billingMonth", "billing_month");
    mirror("customerName", "customer_name");
    mirror("customerFirstName", "firstName");
    mirror("customerLastName", "lastName");
    mirror("customerEmail", "customer_email");
    mirror("customerPhone", "customer_phone");
    mirror("customerAddress", "customer_address");
    mirror("dueDate", "due_date");
    mirror("journeyId", "journey_id");
    mirror("driverName", "driver_name");
    mirror("driverId", "driver_id");
    mirror("truckReg", "truck_reg");
    mirror("trailerReg", "trailer_reg");
    mirror("waybillNo", "waybill_no");
    mirror("borderPoint", "border_point");
    mirror("mpesaRef", "mpesa_ref");
    mirror("businessName", "business_name");
    mirror("destination", "dest");
    mirror("verifyUrl", "verify_url");
    mirror("resetUrl", "reset_url");
    mirror("loginEmail", "login_email");
    mirror("loginUrl", "login_url");
    mirror("supportEmail", "support_email");
    mirror("supportPhone", "support_phone");
    mirror("docLabel", "doc_label");
    mirror("docType", "doc_type");
    mirror("expiryDate", "expiry_date");
    mirror("downloadUrl", "download_url");
    mirror("uploadedAt", "uploaded_at");

    mirror("totalPaid", "total_paid");
    mirror("balanceDue", "balance_due");
    mirror("paidAmount", "paid_amount");

    return c;
}
