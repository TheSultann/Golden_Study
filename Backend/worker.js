// Backend/worker.js

const { Worker } = require('bullmq');
const { URL } = require('url');
const mongoose = require('mongoose');
require('dotenv').config();

const TuitionPayment = require('./models/TuitionPayment');
const User = require('./models/User');
const Group = require('./models/Group');
const Lesson = require('./models/Lesson');
const Evaluation = require('./models/Evaluation');
const { clearUserCacheById, clearOverviewCache } = require('./middleware/cache.middleware');

const generateInvoicesJob = async (job) => {
    // ... (Этот код не меняется)
    const { billingPeriod, groupAmounts } = job.data;
    console.log(`[Worker] Начата задача 'generate-invoices' за ${billingPeriod}...`);
    try {
        const allNewPayments = [];
        const existingPayments = await TuitionPayment.find({ billingPeriod }).select('student').lean();
        const studentsWithInvoice = new Set(existingPayments.map(p => p.student.toString()));
        for (const [groupId, amount] of Object.entries(groupAmounts)) {
            if (!amount || Number(amount) <= 0) continue;
            const studentsToBill = await User.find({ role: 'student', group: groupId, _id: { $nin: Array.from(studentsWithInvoice) } }).select('_id');
            if (studentsToBill.length > 0) {
                const paymentsForGroup = studentsToBill.map(student => ({ student: student._id, group: groupId, billingPeriod: billingPeriod, amountDue: Number(amount), status: 'unpaid' }));
                allNewPayments.push(...paymentsForGroup);
            }
        }
        if (allNewPayments.length === 0) {
            console.log(`[Worker] 'generate-invoices': Новых счетов для генерации не найдено.`);
            return { createdCount: 0 };
        }
        const result = await TuitionPayment.insertMany(allNewPayments);
        console.log(`[Worker] 'generate-invoices' завершена. Создано: ${result.length}`);
        return { createdCount: result.length };
    } catch (e) {
        console.error('[Worker] Ошибка в задаче \'generate-invoices\':', e.message);
        throw e;
    }
};

const deleteGroupJob = async (job) => {
    const { groupId } = job.data;
    console.log(`[Worker] Начата задача 'delete-group' для группы ${groupId}...`);
    
    // Инициализируем сессию для транзакции
    const session = await mongoose.startSession();
    
    try {
        // Начинаем транзакцию
        session.startTransaction();

        const group = await Group.findById(groupId).session(session).lean();
        if (!group) {
            console.log(`[Worker] 'delete-group': Группа ${groupId} уже удалена или не найдена.`);
            await session.abortTransaction(); // Завершаем транзакцию, если группы нет
            session.endSession();
            return;
        }

        const lessonIdsToDelete = (await Lesson.find({ group: groupId }).select('_id').session(session).lean()).map(lesson => lesson._id);

        if (lessonIdsToDelete.length > 0) {
            await Evaluation.deleteMany({ lesson: { $in: lessonIdsToDelete } }).session(session);
        }
        await Lesson.deleteMany({ group: groupId }).session(session);
        await User.updateMany({ _id: { $in: group.students } }, { $set: { group: null } }).session(session);
        await Group.findByIdAndDelete(groupId).session(session);

        // Если все операции успешны, подтверждаем транзакцию
        await session.commitTransaction();
        console.log(`[Worker] 'delete-group': Группа ${groupId} и все связанные данные успешно удалены.`);
    } catch (e) {
        // Если произошла ошибка, откатываем все изменения
        await session.abortTransaction();
        console.error(`[Worker] Ошибка в задаче 'delete-group' для группы ${groupId}:`, e.message);
        throw e; // Перебрасываем ошибку, чтобы BullMQ мог повторить задачу
    } finally {
        // Всегда завершаем сессию
        session.endSession();
    }
};


const clearCachesJob = async (job) => {
    // ... (Этот код не меняется)
    const { userId } = job.data;
    console.log(`[Worker] Начата задача 'clear-caches' для пользователя ${userId}...`);
    try {
        await Promise.all([
            clearUserCacheById(userId),
            clearOverviewCache()
        ]);
        console.log(`[Worker] 'clear-caches' для пользователя ${userId} завершена.`);
    } catch (e) {
        console.error(`[Worker] Ошибка в задаче 'clear-caches' для пользователя ${userId}:`, e.message);
        throw e;
    }
};

const mainProcessor = async (job) => {
    switch (job.name) {
        case 'generate-invoices':
            return await generateInvoicesJob(job);
        case 'delete-group':
            return await deleteGroupJob(job);
        case 'clear-caches':
            return await clearCachesJob(job);
        default:
            throw new Error(`Неизвестный тип задачи: ${job.name}`);
    }
};

(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[Worker] Подключен к MongoDB.');
    const redisUrl = new URL(process.env.REDIS_URL);
    const connectionOptions = { host: redisUrl.hostname, port: redisUrl.port, password: redisUrl.password };
    console.log('[Worker] Запущен и ожидает задач из очереди "task-queue"...');
    new Worker('task-queue', mainProcessor, {
        connection: connectionOptions,
        concurrency: 5
    });
})();