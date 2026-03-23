const fs = require('fs');
const path = require('path');

const DOCS_PATH = path.join(__dirname, 'documents.json');

function readDocs() {
    try { return JSON.parse(fs.readFileSync(DOCS_PATH, 'utf8')); }
    catch { return { documents: [] }; }
}

function writeDocs(data) {
    fs.writeFileSync(DOCS_PATH, JSON.stringify(data, null, 2));
}

function addDocument({ id, entityType, entityId, docType, label, filename, url, r2Key, uploadedBy, expiryDate, fileSize, mimeType }) {
    const db = readDocs();
    const uid = () => Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();
    db.documents.push({
        id: id || uid(),
        entityType,       // 'truck' | 'driver'
        entityId,         // e.g. 'T001' | 'D001'
        docType,          // 'insurance' | 'comesa' | 'ntsa' | 'psv_licence' | etc.
        label,            // Human-readable name e.g. "Lorry Insurance 2025"
        filename,
        url,              // Public R2 URL
        r2Key,            // R2 object key (for deletion)
        uploadedBy,       // 'admin' | driverId
        uploadedAt: new Date().toISOString(),
        expiryDate: expiryDate || null,   // YYYY-MM-DD — for expiry alerts
        fileSize: fileSize || 0,
        mimeType: mimeType || 'application/pdf',
        isExpired: expiryDate ? new Date(expiryDate) < new Date() : false,
        daysUntilExpiry: expiryDate ? Math.ceil((new Date(expiryDate) - new Date()) / 86400000) : null,
    });
    writeDocs(db);
    return db.documents[db.documents.length - 1];
}

function getDocuments(entityType, entityId) {
    const db = readDocs();
    return db.documents.filter(d =>
        (!entityType || d.entityType === entityType) &&
        (!entityId || d.entityId === entityId)
    ).map(d => ({
        ...d,
        // Refresh expiry status on read
        isExpired: d.expiryDate ? new Date(d.expiryDate) < new Date() : false,
        daysUntilExpiry: d.expiryDate ? Math.ceil((new Date(d.expiryDate) - new Date()) / 86400000) : null,
    }));
}

function getAllExpiringDocuments(withinDays = 30) {
    const db = readDocs();
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + withinDays);
    return db.documents.filter(d => {
        if (!d.expiryDate) return false;
        const exp = new Date(d.expiryDate);
        return exp <= threshold;
    }).map(d => ({
        ...d,
        isExpired: new Date(d.expiryDate) < new Date(),
        daysUntilExpiry: Math.ceil((new Date(d.expiryDate) - new Date()) / 86400000),
    })).sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}

function deleteDocument(docId) {
    const db = readDocs();
    const doc = db.documents.find(d => d.id === docId);
    if (!doc) return null;
    db.documents = db.documents.filter(d => d.id !== docId);
    writeDocs(db);
    return doc; // return so caller can delete from R2
}

module.exports = { addDocument, getDocuments, getAllExpiringDocuments, deleteDocument };
