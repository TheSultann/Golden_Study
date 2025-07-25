// Backend/middleware/auth.middleware.js

const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    if (req.method === 'OPTIONS') {
        return next();
    }

    try {
        const token = req.headers.authorization.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'Нет авторизации' });
        }

        // ИЗМЕНЕНО: Секрет берется из переменных окружения
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        req.user = decoded;
        next();

    } catch (e) {
        res.status(401).json({ message: 'Нет авторизации' });
    }
}