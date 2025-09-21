// Backend/queues/taskQueue.js

const { Queue } = require('bullmq');
const { URL } = require('url');
require('dotenv').config();

// Парсим REDIS_URL, чтобы BullMQ его понял
const redisUrl = new URL(process.env.REDIS_URL);
const connectionOptions = {
    host: redisUrl.hostname,
    port: redisUrl.port,
    password: redisUrl.password,
};

// Создаем новую, более универсальную очередь для всех типов задач
const taskQueue = new Queue('task-queue', {
    connection: connectionOptions,
});

module.exports = taskQueue;