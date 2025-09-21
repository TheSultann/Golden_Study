const { Router } = require('express');
const router = Router();
const auth = require('../middleware/auth.middleware');
const TuitionPayment = require('../models/TuitionPayment');
const User = require('../models/User');
const redisClient = require('../redis-client');
const asyncHandler = require('../utils/asyncHandler'); // --- 1. ИМПОРТИРУЕМ ОБЕРТКУ ---

const clearFinanceCache = async (req, res, next) => {
    try {
        if (redisClient.isOpen) {
            // Используем SCAN вместо KEYS для безопасности в продакшене
            const stream = redisClient.scanIterator({ MATCH: 'cache:GET:/api/finance*', COUNT: 100 });
            const keysToDelete = [];
            for await (const key of stream) {
                keysToDelete.push(key);
            }
            if (keysToDelete.length > 0) {
                await redisClient.del(keysToDelete);
                console.log(`FINANCE CACHE CLEARED: ${keysToDelete.length} keys deleted.`);
            }
        }
    } catch (e) {
        console.error('Error clearing finance cache:', e);
    }
    next();
};

// --- 2. ОБОРАЧИВАЕМ РОУТЫ В asyncHandler И УБИРАЕМ try...catch ---

router.get('/last-amounts', [auth, auth.adminOnly], asyncHandler(async (req, res) => {
    const lastAmounts = await TuitionPayment.aggregate([
        { $sort: { billingPeriod: -1 } },
        { $group: { _id: '$group', lastAmount: { $first: '$amountDue' } } }
    ]);
    const amountsMap = lastAmounts.reduce((acc, item) => {
        if (item._id) {
            acc[item._id] = item.lastAmount;
        }
        return acc;
    }, {});
    res.json(amountsMap);
}));

router.post('/generate', [auth, auth.adminOnly, clearFinanceCache], asyncHandler(async (req, res) => {
    const { billingPeriod, groupAmounts } = req.body;
    if (!billingPeriod || !groupAmounts || Object.keys(groupAmounts).length === 0) {
        return res.status(400).json({ message: 'Необходимо указать период и выбрать хотя бы одну группу с суммой' });
    }

    const allNewPayments = [];
    const existingPayments = await TuitionPayment.find({ billingPeriod }).select('student').lean();
    const studentsWithInvoice = new Set(existingPayments.map(p => p.student.toString()));

    for (const [groupId, amount] of Object.entries(groupAmounts)) {
        if (!amount || Number(amount) <= 0) continue;

        const studentsToBill = await User.find({
            role: 'student',
            group: groupId,
            _id: { $nin: Array.from(studentsWithInvoice) }
        }).select('_id').lean(); // Добавляем .lean()

        if (studentsToBill.length > 0) {
            const paymentsForGroup = studentsToBill.map(student => ({
                student: student._id,
                group: groupId,
                billingPeriod: billingPeriod,
                amountDue: Number(amount),
                status: 'unpaid'
            }));
            allNewPayments.push(...paymentsForGroup);
        }
    }

    if (allNewPayments.length === 0) {
        return res.status(200).json({ message: 'Новых счетов для генерации не найдено.', createdCount: 0 });
    }

    const result = await TuitionPayment.insertMany(allNewPayments);
    res.status(201).json({ message: 'Генерация счетов завершена', createdCount: result.length });
}));

router.get('/', [auth, auth.adminOnly], asyncHandler(async (req, res) => {
    const cacheKey = `cache:GET:${req.originalUrl}`;
    if (redisClient.isOpen) {
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            console.log(`CACHE HIT: ${cacheKey}`);
            return res.json(JSON.parse(cachedData));
        }
    }

    console.log(`CACHE MISS: ${cacheKey}`);
    const { periodStart, periodEnd, groupId } = req.query;
    if (!periodStart || !periodEnd) {
        return res.status(400).json({ message: 'Необходимо указать начальный и конечный период' });
    }

    const filter = {
        billingPeriod: { $gte: periodStart, $lte: periodEnd }
    };

    if (groupId && groupId !== 'all') {
        const studentsInGroup = await User.find({ group: groupId, role: 'student' }).select('_id').lean();
        const studentIds = studentsInGroup.map(s => s._id);
        if (studentIds.length === 0) {
            return res.json([]);
        }
        filter.student = { $in: studentIds };
    }

    const payments = await TuitionPayment.find(filter)
        .populate('student', 'name')
        .populate('group', 'name')
        .sort({ 'billingPeriod': -1, 'student.name': 1 })
        .lean(); // Добавляем .lean()

    if (redisClient.isOpen) {
        redisClient.setEx(cacheKey, 3600, JSON.stringify(payments));
    }
    res.json(payments);
}));

router.patch('/:paymentId/pay', [auth, auth.adminOnly, clearFinanceCache], asyncHandler(async (req, res) => {
    const payment = await TuitionPayment.findById(req.params.paymentId);
    if (!payment) return res.status(404).json({ message: 'Счет не найден' });

    payment.status = 'paid';
    payment.paymentDate = new Date();
    payment.amountPaid = payment.amountDue;
    await payment.save();

    const updatedPayment = await TuitionPayment.findById(payment._id)
        .populate('student', 'name')
        .populate('group', 'name')
        .lean(); // Добавляем .lean()

    res.json(updatedPayment);
}));

module.exports = router;