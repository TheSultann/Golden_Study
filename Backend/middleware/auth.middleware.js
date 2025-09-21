const jwt = require('jsonwebtoken');

// Основная функция аутентификации (без изменений)
const authMiddleware = (req, res, next) => {
    if (req.method === 'OPTIONS') {
        return next();
    }
    try {
        const token = req.headers.authorization.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Нет авторизации' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        res.status(401).json({ message: 'Нет авторизации' });
    }
};

// Middleware для проверки прав администратора (без изменений)
authMiddleware.adminOnly = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Доступ запрещен. Требуются права администратора.' });
    }
    next();
};

// --- НОВЫЙ БЛОК: Middleware для проверки прав Учителя ИЛИ Администратора ---
// Эта проверка гарантирует, что только эти две роли могут получить доступ к ресурсу.
authMiddleware.teacherOrAdmin = (req, res, next) => {
    if (!req.user || (req.user.role !== 'teacher' && req.user.role !== 'admin')) {
        return res.status(403).json({ message: 'Доступ запрещен. Требуются права учителя или администратора.' });
    }
    next();
};
// --- КОНЕЦ НОВОГО БЛОКА ---

module.exports = authMiddleware;