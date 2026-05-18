const { Router } = require('express');
const router = Router();
const auth = require('../middleware/auth.middleware');
const TuitionPayment = require('../models/TuitionPayment');
const User = require('../models/User');
const redisClient = require('../redis-client');
const { cache, clearCacheByPattern } = require('../middleware/cache.middleware');
const asyncHandler = require('../utils/asyncHandler'); // --- 1. ИМПОРТИРУЕМ ОБЕРТКУ ---

const clearFinanceCache = async (req, res, next) => {
    try {
        if (redisClient.isOpen) {
            // Clear all finance-related cache keys (admin + student)
            const patterns = ['cache:*:/api/finance*', 'cache:*:/api/student*'];
            for (const pattern of patterns) {
                const stream = redisClient.scanIterator({ MATCH: pattern, COUNT: 100 });
                const keysToDelete = [];
                for await (const key of stream) {
                    keysToDelete.push(key);
                }
                if (keysToDelete.length > 0) {
                    await redisClient.del(keysToDelete);
                }
            }
        }
    } catch (e) {
        console.error('Error clearing finance cache:', e);
    }
    next();
};

// --- 2. ОБОРАЧИВАЕМ РОУТЫ В asyncHandler И УБИРАЕМ try...catch ---

router.get('/last-amounts', [auth, auth.adminOnly, cache(300)], asyncHandler(async (req, res) => {
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

// Student-only route: get authenticated student's payment records
router.get('/my-payments', [auth, auth.studentOnly, cache(300)], asyncHandler(async (req, res) => {
    const studentId = req.user.userId;

    const payments = await TuitionPayment.find({ student: studentId })
        .populate('group', 'name')
        .sort({ billingPeriod: -1 })
        .lean();

    const result = payments.map(p => ({
        billingPeriod: p.billingPeriod,
        amountDue: p.amountDue,
        amountPaid: p.amountPaid,
        paymentDate: p.paymentDate || null,
        status: p.status,
        groupName: p.group?.name || 'Unknown'
    }));

    res.json(result);
}));

router.get('/', [auth, auth.adminOnly, cache(3600)], asyncHandler(async (req, res) => {
    const { periodStart, periodEnd, groupId, page = 1, limit = 50 } = req.query;
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
            return res.json({ payments: [], total: 0, page: 1, totalPages: 0 });
        }
        filter.student = { $in: studentIds };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [payments, total] = await Promise.all([
        TuitionPayment.find(filter)
            .populate('student', 'name')
            .populate('group', 'name')
            .sort({ 'billingPeriod': -1 })
            .skip(skip)
            .limit(Number(limit))
            .lean(),
        TuitionPayment.countDocuments(filter)
    ]);

    res.json({
        payments,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit))
    });
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
