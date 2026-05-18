const mongoose = require('mongoose');
require('dotenv').config();
const app = require('./app');
const { startInvoiceScheduler } = require('./jobs/invoiceScheduler');
const { getServerEnv } = require('./config/env');

async function start() {
    try {
        const { mongoUri, port } = getServerEnv();

        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        startInvoiceScheduler();
        console.log('Invoice scheduler has been started.');

        app.listen(port, () => console.log(`Server started on port ${port}`));
    } catch (e) {
        console.log('Server Error', e.message);
        process.exit(1);
    }
}

start();
