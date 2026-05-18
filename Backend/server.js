const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const app = require('./app');
const { startInvoiceScheduler } = require('./jobs/invoiceScheduler');
const { getServerEnv } = require('./config/env');

// Keep-alive: ping self every 14 minutes to prevent Render free tier sleep
function startKeepAlive(url) {
    const interval = 14 * 60 * 1000; // 14 minutes
    setInterval(async () => {
        try {
            const res = await fetch(url);
            console.log(`[Keep-alive] Ping ${res.status}`);
        } catch (e) {
            console.error('[Keep-alive] Failed:', e.message);
        }
    }, interval);
}

async function start() {
    try {
        const { mongoUri, port } = getServerEnv();

        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        startInvoiceScheduler();
        console.log('Invoice scheduler has been started.');

        app.listen(port, () => {
            console.log(`Server started on port ${port}`);
            // Start keep-alive only in production
            if (process.env.RENDER_EXTERNAL_URL) {
                startKeepAlive(process.env.RENDER_EXTERNAL_URL);
            }
        });
    } catch (e) {
        console.log('Server Error', e.message);
        process.exit(1);
    }
}

start();
