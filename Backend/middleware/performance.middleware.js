// Backend/middleware/performance.middleware.js

const performanceMiddleware = (req, res, next) => {
    const start = process.hrtime(); // Запускаем таймер высокого разрешения

    // Ждем, пока ответ будет полностью отправлен клиенту
    res.on('finish', () => {
        const diff = process.hrtime(start); // Останавливаем таймер
        const timeInMs = (diff[0] * 1e3) + (diff[1] * 1e-6); // Конвертируем в миллисекунды
        
        // Выводим в консоль метод, URL и время выполнения
        console.log(`[Performance] ${req.method} ${req.originalUrl} - ${timeInMs.toFixed(2)} ms`);
    });

    next(); // Передаем управление следующему обработчику
};

module.exports = performanceMiddleware;