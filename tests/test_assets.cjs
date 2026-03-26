const request = require('supertest');
const path = require('path');
const express = require('express');
const fs = require('fs');

// We'll test with a mock express app that mimics the server's configuration
const app = express();

const DRIVER_DIST = path.join(__dirname, '../driver-portal/dist');
const ADMIN_DIST = path.join(__dirname, '../dist');

// Mock static serving
app.use('/driver', express.static(DRIVER_DIST));

// SPA Fallback logic from index.js
app.use((req, res, next) => {
    const isAsset = req.path.includes('/assets/') || req.path.match(/\.(css|js|png|jpg|jpeg|svg|ico|json|txt|woff2?|ttf|eot|webp)$/i);
    if (isAsset) {
        return res.status(404).set('Content-Type', 'text/plain').send('Asset not found');
    }
    
    if (req.path.startsWith('/driver')) {
        return res.status(200).send('mock driver index.html');
    }
    res.status(200).send('mock admin index.html');
});

async function runTests() {
    console.log('Running Asset Tests...');

    // 1. Test existing asset
    // Note: We need to make sure the file exists for this test to pass
    const assetPath = path.join(DRIVER_DIST, 'assets/index-C5a08ro4.css');
    if (fs.existsSync(assetPath)) {
        await request(app)
            .get('/driver/assets/index-C5a08ro4.css')
            .expect(200)
            .expect('Content-Type', /css/)
            .then(() => console.log('✅ Existing asset served correctly.'));
    } else {
        console.log('⚠️ Skip existing asset test: file not found at ' + assetPath);
    }

    // 2. Test missing asset (Should return 404 text/plain, NOT HTML)
    await request(app)
        .get('/driver/assets/nonexistent-file.css')
        .expect(404)
        .expect('Content-Type', /text\/plain/)
        .then(res => {
            if (res.text === 'Asset not found') {
                console.log('✅ Missing asset returned 404 text/plain.');
            } else {
                console.log('❌ Missing asset returned wrong body: ' + res.text);
            }
        });

    // 3. Test SPA route (Should return HTML)
    await request(app)
        .get('/driver/dashboard')
        .expect(200)
        .then(res => {
            if (res.text === 'mock driver index.html') {
                console.log('✅ SPA route returned index.html.');
            } else {
                console.log('❌ SPA route returned wrong body: ' + res.text);
            }
        });

    console.log('Tests completed.');
}

runTests().catch(err => {
    console.error('Tests failed:', err);
    process.exit(1);
});
