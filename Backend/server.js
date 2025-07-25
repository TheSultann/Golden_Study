// Backend/server.js

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');        // <-- ДОБАВЛЕНО
require('dotenv').config();          // <-- ДОБАВЛЕНО

const app = express();

app.use(express.json());
app.use(cors());

// Роуты API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/lessons', require('./routes/lessons'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/evaluations', require('./routes/evaluations'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/user', require('./routes/user'));

// --- ДОБАВЛЕН БЛОК ДЛЯ PRODUCTION ---
if (process.env.NODE_ENV === 'production') {
    // Устанавливаем статическую папку для билда фронтенда
    app.use(express.static(path.join(__dirname, '..', 'dist')));

    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, '..', 'dist', 'index.html'));
    });
}
// --- КОНЕЦ БЛОКА ---


const PORT = process.env.PORT || 5000; // <-- ИЗМЕНЕНО
const MONGO_URI = process.env.MONGO_URI; // <-- ИЗМЕНЕНО

async function start() {
    try {
        if (!MONGO_URI) {
            throw new Error('MONGO_URI must be defined in .env file');
        }
        await mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
    } catch (e) {
        console.log('Server Error', e.message);
        process.exit(1);
    }
}

start();