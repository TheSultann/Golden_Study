// Backend/server.js

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const performanceMiddleware = require('./middleware/performance.middleware');
const { startInvoiceScheduler } = require('./jobs/invoiceScheduler');
const errorHandler = require('./middleware/error.middleware'); // --- 1. ИМПОРТИРУЕМ ОБРАБОТЧИК ---

const app = express();

app.use(express.json());
app.use(cors());
app.use(performanceMiddleware);

app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'UP' });
});

// Роуты API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/lessons', require('./routes/lessons'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/evaluations', require('./routes/evaluations'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/user', require('./routes/user'));
app.use('/api/finance', require('./routes/finance'));
app.use('/api/accounting', require('./routes/accounting'));
app.use('/api/overview', require('./routes/overview'));

// Обслуживание фронтенда в production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '..', 'dist')));
    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, '..', 'dist', 'index.html'));
    });
}

// --- 2. ПОДКЛЮЧАЕМ ОБРАБОТЧИК ОШИБОК В САМОМ КОНЦЕ ---
// Он должен идти ПОСЛЕ всех роутов.
app.use(errorHandler);
// --- КОНЕЦ НОВОГО БЛОКА ---

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

async function start() {
    try {
        if (!MONGO_URI) {
            throw new Error('MONGO_URI must be defined in .env file');
        }
        
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');
        
        startInvoiceScheduler();
        console.log('Invoice scheduler has been started.');
       
        app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
    } catch (e) {
        console.log('Server Error', e.message);
        process.exit(1);
    }
}

start();