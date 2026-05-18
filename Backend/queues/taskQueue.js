const { Queue } = require('bullmq');
const { URL } = require('url');
require('dotenv').config();
const { isRedisDisabled } = require('../config/env');

function createDisabledQueue() {
    return {
        add: async () => null,
    };
}

function createTaskQueue() {
    const redisUrl = new URL(process.env.REDIS_URL);
    const connectionOptions = {
        host: redisUrl.hostname,
        port: redisUrl.port,
        password: redisUrl.password,
    };

    return new Queue('task-queue', {
        connection: connectionOptions,
    });
}

module.exports = isRedisDisabled() ? createDisabledQueue() : createTaskQueue();
