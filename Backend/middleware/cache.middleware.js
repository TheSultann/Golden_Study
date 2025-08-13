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
    // --- ИЗМЕНЕНИЕ: Возвращаем проверку, чтобы кеш работал только в production ---
    if (process.env.NODE_ENV !== 'production' || !redisClient.isOpen) {
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

const clearCacheForUser = async (req, res, next) => {
    try {
        if (redisClient.isOpen && req.user) {
            const userIdentifier = req.user.userId;
            const stream = redisClient.scanIterator({
                MATCH: `cache:${userIdentifier}:*`,
                COUNT: 100
            });
            
            const keysToDelete = [];
            for await (const key of stream) {
                keysToDelete.push(key);
            }

            if (keysToDelete.length > 0) {
                await redisClient.del(keysToDelete);
                console.log(`CACHE CLEARED for user ${userIdentifier}. Keys deleted:`, keysToDelete.length);
            }
        }
    } catch (err) {
        console.error('Error clearing cache for user:', err);
    }
    next();
};

module.exports = {
    cache: cacheMiddleware,
    clearCache: clearCacheForUser
};