// Backend/middleware/cache.middleware.js

const redisClient = require('../redis-client');
const querystring = require('querystring');

const generateCacheKey = (req) => {
    const path = req.originalUrl.split('?')[0];
    const query = { ...req.query };
    delete query._;
    const sortedQuery = querystring.stringify(Object.fromEntries(Object.entries(query).sort()));
    const userIdentifier = req.user ? req.user.userId : 'public';
    return `cache:${userIdentifier}:${req.method}:${path}?${sortedQuery}`;
};

const cacheMiddleware = (durationInSeconds) => async (req, res, next) => {
    if (process.env.NODE_ENV === 'test' || !redisClient.isOpen) {
        return next();
    }
    const key = generateCacheKey(req);
    try {
        const cachedData = await redisClient.get(key);
        if (cachedData) {
            try {
                const data = JSON.parse(cachedData);
                console.log(`CACHE HIT: ${key}`);
                return res.json(data);
            } catch (e) {
                console.error('Invalid data in cache, deleting key:', key, e);
                await redisClient.del(key);
                return next();
            }
        }
        console.log(`CACHE MISS: ${key}`);
        const originalJson = res.json;
        res.json = (data) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                 redisClient.setEx(key, durationInSeconds, JSON.stringify(data));
            }
            originalJson.call(res, data);
        };
        next();
    } catch (err) {
        console.error('Redis cache error:', err);
        next();
    }
};

const clearCacheByPattern = async (pattern) => {
    if (!redisClient.isOpen || !pattern) {
        return 0;
    }

    try {
        const stream = redisClient.scanIterator({ MATCH: pattern, COUNT: 100 });
        const keysToDelete = [];

        for await (const key of stream) {
            keysToDelete.push(key);
        }

        if (keysToDelete.length > 0) {
            await redisClient.del(keysToDelete);
            console.log(`CACHE CLEARED by pattern ${pattern}. Keys deleted:`, keysToDelete.length);
        }

        return keysToDelete.length;
    } catch (err) {
        console.error(`Error clearing cache by pattern ${pattern}:`, err);
        return 0;
    }
};

const clearCacheForUser = async (req, res, next) => {
    try {
        if (redisClient.isOpen && req.user) {
            const userIdentifier = req.user.userId;
            await clearCacheByPattern(`cache:${userIdentifier}:*`);
        }
    } catch (err) {
        console.error('Error clearing cache for user:', err);
    }
    next();
};

const clearOverviewCache = async (req, res, next) => {
    try {
        if (redisClient.isOpen) {
            const overviewCacheKey = 'cache:GET:/api/overview/teachers';
            const result = await redisClient.del(overviewCacheKey);
            if (result > 0) {
                console.log(`OVERVIEW CACHE CLEARED. Key deleted: ${overviewCacheKey}`);
            }
        }
    } catch (err) {
        console.error('Error clearing overview cache:', err);
    }
    // Если req передан, это middleware, иначе - обычная функция
    if (next && typeof next === 'function') {
        next();
    }
};

const clearUserCacheById = async (userId) => {
    if (!redisClient.isOpen || !userId) return;
    try {
        await clearCacheByPattern(`cache:${userId}:*`);
    } catch (err) {
        console.error('Error clearing cache for user by ID:', err);
    }
};

module.exports = {
    cache: cacheMiddleware,
    clearCache: clearCacheForUser,
    clearOverviewCache,
    clearUserCacheById,
    clearCacheByPattern
};
