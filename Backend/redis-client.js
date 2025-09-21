// Backend/redis-client.js

const { createClient } = require('redis');
require('dotenv').config();

const redisClient = createClient({
    url: process.env.REDIS_URL,
    socket: {
        // --- ДОБАВЛЕНА ЛОГИКА ПЕРЕПОДКЛЮЧЕНИЯ ---
        reconnectStrategy: (retries) => {
            // Если попыток больше 10, сдаемся
            if (retries > 10) {
                return new Error('Не удалось подключиться к Redis после 10 попыток.');
            }
            // С каждой попыткой ждем чуть дольше (но не более 3 секунд)
            return Math.min(retries * 100, 3000);
        }
    }
});

// --- ДОБАВЛЕНЫ БОЛЕЕ ИНФОРМАТИВНЫЕ ЛОГИ ---
redisClient.on('error', (err) => console.error('Redis Client Error:', err.message));
redisClient.on('connect', () => console.log('Успешное подключение к Redis.'));
redisClient.on('reconnecting', () => console.log('Переподключение к Redis...'));

// --- ЗАПУСКАЕМ ПОДКЛЮЧЕНИЕ ---
redisClient.connect();

module.exports = redisClient;