const express = require('express');
const cors = require('cors');
const path = require('path');
const performanceMiddleware = require('./middleware/performance.middleware');
const errorHandler = require('./middleware/error.middleware');

const app = express();

app.use(express.json());
app.use(cors());
app.use(performanceMiddleware);

app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'UP' });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/lessons', require('./routes/lessons'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/evaluations', require('./routes/evaluations'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/user', require('./routes/user'));
app.use('/api/finance', require('./routes/finance'));
app.use('/api/accounting', require('./routes/accounting'));
app.use('/api/overview', require('./routes/overview'));
app.use('/api/student', require('./routes/student'));
app.use('/api/attendance', require('./routes/attendance'));

if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '..', 'dist')));
    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, '..', 'dist', 'index.html'));
    });
}

app.use(errorHandler);

module.exports = app;
