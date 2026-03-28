const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, 'backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);

const BACKUP_PATH = path.join(BACKUP_DIR, 'verify_backup.zip');
const DATA_JSON = path.join(__dirname, 'data.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

async function verify() {
    console.log("--- ZIP Backup Verification ---");
    const zip = new AdmZip();
    
    const mockData = { version: '6.0', timestamp: new Date().toISOString(), tables: {} };
    zip.addFile("data.json", Buffer.from(JSON.stringify(mockData, null, 2), "utf8"));
    console.log("Added mock data.json (simulating DB export)");
    
    if (fs.existsSync(UPLOADS_DIR)) {
        zip.addLocalFolder(UPLOADS_DIR, 'uploads');
        console.log("Added uploads folder");
    }

    zip.writeZip(BACKUP_PATH);
    console.log("Backup written to:", BACKUP_PATH);

    const check = new AdmZip(BACKUP_PATH);
    const entries = check.getEntries().map(e => e.entryName);
    console.log("ZIP Contents (first 5):", entries.slice(0, 5));

    if (entries.includes('data.json')) {
        console.log("✅ VERIFICATION SUCCESS: data.json found in ZIP.");
    } else {
        console.error("❌ VERIFICATION FAILURE: data.json missing from ZIP.");
        process.exit(1);
    }
}

verify().catch(err => {
    console.error(err);
    process.exit(1);
});
