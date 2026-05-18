const { createClient } = require('redis');
require('dotenv').config();
const { isRedisDisabled } = require('./config/env');

const disabledRedisClient = {
    isOpen: false,
    get: async () => null,
    setEx: async () => null,
    del: async () => 0,
    scanIterator: async function* () {},
};

function createRedisClient() {
    const redisClient = createClient({
        url: process.env.REDIS_URL,
        socket: {
            reconnectStrategy: (retries) => {
                if (retries > 10) {
                    return new Error('Could not connect to Redis after 10 attempts.');
                }
                return Math.min(retries * 100, 3000);
            }
        }
    });

    redisClient.on('error', (err) => console.error('Redis Client Error:', err.message));
    redisClient.on('connect', () => console.log('Connected to Redis.'));
    redisClient.on('reconnecting', () => console.log('Reconnecting to Redis...'));

    redisClient.connect().catch((err) => {
        console.error('Redis initial connection failed:', err.message);
    });

    return redisClient;
}

module.exports = isRedisDisabled() ? disabledRedisClient : createRedisClient();
