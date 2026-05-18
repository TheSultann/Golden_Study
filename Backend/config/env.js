require('dotenv').config();

function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} must be defined`);
    }
    return value;
}

function getServerEnv() {
    return {
        port: process.env.PORT || 5000,
        mongoUri: requireEnv('MONGO_URI'),
        jwtSecret: requireEnv('JWT_SECRET'),
        nodeEnv: process.env.NODE_ENV || 'development',
    };
}

function isRedisDisabled() {
    return process.env.NODE_ENV === 'test' || process.env.REDIS_DISABLED === 'true' || !process.env.REDIS_URL;
}

module.exports = {
    getServerEnv,
    isRedisDisabled,
};
