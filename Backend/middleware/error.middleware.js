// Backend/middleware/error.middleware.js

const errorHandler = (err, req, res, next) => {
    console.error(`[Error Handler] Path: ${req.path}, Error: ${err.message}`);
    
    // Если у ошибки есть статус (например, 404, 403), используем его.
    // Иначе, это внутренняя ошибка сервера (500).
    const statusCode = err.statusCode || 500;
    
    res.status(statusCode).json({
        message: err.message || 'Что-то пошло не так на сервере',
        // В режиме разработки можно добавить и сам стектрейс ошибки для удобства
        stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack
    });
};

module.exports = errorHandler;