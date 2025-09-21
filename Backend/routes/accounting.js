// Backend/routes/accounting.js

const { Router } = require('express');
const router = Router();
const auth = require('../middleware/auth.middleware');
const Salary = require('../models/Salary');
const Expense = require('../models/Expense');
const User = require('../models/User');
const TuitionPayment = require('../models/TuitionPayment'); 
const redisClient = require('../redis-client'); 
const asyncHandler = require('../utils/asyncHandler'); // --- 1. ИМПОРТИРУЕМ ОБЕРТКУ ---

const clearAccountingCache = async (req, res, next) => {
    // Этот мидлвэр не асинхронный роут, оставляем try...catch для безопасности
    try {
        if (redisClient.isOpen) {
            const keysToDelete = [
                'cache:GET:/api/accounting/trends',
                `cache:GET:/api/accounting/summary?period=${new Date().toISOString().slice(0, 7)}`
            ];
            await redisClient.del(keysToDelete);
            console.log(`ACCOUNTING CACHE CLEARED.`);
        }
    } catch (e) {
        console.error('Error clearing accounting cache:', e);
    }
    next();
};

router.use(auth, auth.adminOnly);

// --- 2. ОБОРАЧИВАЕМ КАЖДЫЙ РОУТ В asyncHandler ---

router.get('/salaries', asyncHandler(async (req, res) => {
    const { period } = req.query;
    if (!period) return res.status(400).json({ message: 'Period is required' });
    
    const teachers = await User.find({ role: 'teacher' }).select('_id name').lean();
    const existingSalaries = await Salary.find({ period, teacher: { $in: teachers.map(t => t._id) } });
    const salaryMap = new Map(existingSalaries.map(s => [s.teacher.toString(), s]));
    const salaries = teachers.map(teacher => {
        const existingSalary = salaryMap.get(teacher._id.toString());
        if (existingSalary) return { ...existingSalary.toObject(), teacher };
        return { _id: null, teacher, period, amount: 0, status: 'pending' };
    });
    res.json(salaries);
}));

router.post('/salaries', clearAccountingCache, asyncHandler(async (req, res) => {
    const { teacherId, period, amount } = req.body;
    if (!teacherId || !period || amount === undefined) return res.status(400).json({ message: 'Teacher ID, period, and amount are required' });
    
    const salary = await Salary.findOneAndUpdate(
        { teacher: teacherId, period },
        { amount, status: 'pending' },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    ).populate('teacher', 'name');
    res.status(201).json(salary);
}));

router.patch('/salaries/:id/pay', clearAccountingCache, asyncHandler(async (req, res) => {
    const salary = await Salary.findById(req.params.id);
    if (!salary) return res.status(404).json({ message: 'Salary record not found' });
    if (salary.amount <= 0) return res.status(400).json({ message: 'Cannot pay a salary with zero amount.' });
    
    salary.status = 'paid';
    salary.paymentDate = new Date();
    await salary.save();
    const updatedSalary = await Salary.findById(salary._id).populate('teacher', 'name');
    res.json(updatedSalary);
}));

router.get('/expenses', asyncHandler(async (req, res) => {
    const expenses = await Expense.find().sort({ expenseDate: -1 });
    res.json(expenses);
}));

router.post('/expenses', clearAccountingCache, asyncHandler(async (req, res) => {
    const { description, amount, category, expenseDate } = req.body;
    if (!description || !amount || !category) return res.status(400).json({ message: 'Description, amount, and category are required' });
    
    const newExpense = new Expense({ description, amount, category, expenseDate });
    await newExpense.save();
    res.status(201).json(newExpense);
}));

router.delete('/expenses/:id', clearAccountingCache, asyncHandler(async (req, res) => {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    res.json({ message: 'Expense deleted successfully' });
}));

router.get('/summary', asyncHandler(async (req, res) => {
    const { period } = req.query;
    if (!period) return res.status(400).json({ message: 'Period is required' });
    
    const [incomeResult, salaryResult, expensesResult] = await Promise.all([
        TuitionPayment.aggregate([
            { $match: { billingPeriod: period, status: 'paid' } }, 
            { $group: { _id: null, total: { $sum: '$amountDue' } } }
        ]),
        Salary.aggregate([
            { $match: { period: period, status: 'paid' } }, 
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        Expense.aggregate([
            { $match: { expenseDate: { $gte: new Date(`${period}-01T00:00:00.000Z`), $lt: new Date(new Date(`${period}-01T00:00:00.000Z`).setMonth(new Date(`${period}-01T00:00:00.000Z`).getMonth() + 1)) } } }, 
            { $group: { _id: '$category', totalAmount: { $sum: '$amount' } } }
        ])
    ]);

    const totalIncome = incomeResult[0]?.total || 0;
    const totalSalaries = salaryResult[0]?.total || 0;
    let totalOtherExpenses = 0;
    const expenseBreakdown = expensesResult.map(item => {
        totalOtherExpenses += item.totalAmount;
        return { category: item._id, amount: item.totalAmount };
    });
    if (totalSalaries > 0) expenseBreakdown.unshift({ category: 'salaries', amount: totalSalaries });
    const totalExpenses = totalSalaries + totalOtherExpenses;
    const netProfit = totalIncome - totalExpenses;
    const summaryData = { totalIncome, totalExpenses, netProfit, expenseBreakdown };
    
    res.json(summaryData);
}));

router.get('/trends', asyncHandler(async (req, res) => {
    console.log(`CACHE BYPASSED: /api/accounting/trends`);
    
    const periods = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        periods.push(d.toISOString().slice(0, 7));
    }
    const firstPeriod = periods[0];
    const lastPeriod = periods[periods.length - 1];

    const [incomeData, salaryData, expenseData] = await Promise.all([
        TuitionPayment.aggregate([
            { $match: { status: 'paid', billingPeriod: { $gte: firstPeriod, $lte: lastPeriod } } },
            { $group: { _id: "$billingPeriod", total: { $sum: "$amountDue" } } }
        ]),
        Salary.aggregate([
            { $match: { status: 'paid', period: { $in: periods } } },
            { $group: { _id: "$period", total: { $sum: "$amount" } } }
        ]),
        Expense.aggregate([
            { $match: { expenseDate: { $gte: new Date(`${firstPeriod}-01`) } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$expenseDate" } }, total: { $sum: "$amount" } } }
        ])
    ]);

    const dataMap = new Map();
    periods.forEach(p => dataMap.set(p, { income: 0, expenses: 0 }));

    incomeData.forEach(item => { if(dataMap.has(item._id)) dataMap.get(item._id).income = item.total; });
    salaryData.forEach(item => { if(dataMap.has(item._id)) dataMap.get(item._id).expenses += item.total; });
    expenseData.forEach(item => { if(dataMap.has(item._id)) dataMap.get(item._id).expenses += item.total; });

    const trendData = periods.map(period => {
        const monthData = dataMap.get(period);
        return {
            period,
            income: monthData.income,
            expenses: monthData.expenses,
            profit: monthData.income - monthData.expenses
        };
    });

    res.json(trendData);
}));

module.exports = router;