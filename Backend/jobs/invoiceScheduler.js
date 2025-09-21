// Backend/jobs/invoiceScheduler.js

const cron = require('node-cron');
const TuitionPayment = require('../models/TuitionPayment');
const User = require('../models/User');

/**
 * Основная логика генерации счетов.
 * Находит студентов, определяет для них сумму на основе последнего счета их группы
 * и создает новые счета, если их еще нет за текущий месяц.
 */
const runMonthlyInvoiceGeneration = async () => {
    console.log(`[${new Date().toISOString()}] Running monthly invoice generation job...`);

    try {
        // 1. Определяем текущий период (например, '2025-09')
        const billingPeriod = new Date().toISOString().slice(0, 7);

        // 2. Находим последнюю установленную сумму для каждой группы
        const lastAmounts = await TuitionPayment.aggregate([
            { $sort: { billingPeriod: -1 } },
            { $group: { _id: '$group', lastAmount: { $first: '$amountDue' } } }
        ]);
        const amountsMap = lastAmounts.reduce((acc, item) => {
            if (item._id) acc[item._id.toString()] = item.lastAmount;
            return acc;
        }, {});

        if (Object.keys(amountsMap).length === 0) {
            console.log('Scheduler: No previous invoices found to determine amounts. Skipping job.');
            return;
        }

        // 3. Находим всех студентов, у которых уже есть счет за текущий период
        const existingPayments = await TuitionPayment.find({ billingPeriod }).select('student').lean();
        const studentsWithInvoice = new Set(existingPayments.map(p => p.student.toString()));

        // 4. Находим всех активных студентов
        const allActiveStudents = await User.find({ role: 'student', group: { $ne: null } }).select('_id group').lean();

        // 5. Готовим список счетов для создания
        const newPayments = [];
        for (const student of allActiveStudents) {
            const studentId = student._id.toString();
            const groupId = student.group.toString();

            // Создаем счет, только если его еще нет и для его группы известна сумма
            if (!studentsWithInvoice.has(studentId) && amountsMap[groupId]) {
                newPayments.push({
                    student: studentId,
                    group: groupId,
                    billingPeriod: billingPeriod,
                    amountDue: amountsMap[groupId],
                    status: 'unpaid'
                });
            }
        }

        // 6. Сохраняем новые счета в базу данных
        if (newPayments.length > 0) {
            await TuitionPayment.insertMany(newPayments);
            console.log(`[${new Date().toISOString()}] Successfully created ${newPayments.length} new invoices.`);
        } else {
            console.log(`[${new Date().toISOString()}] No new invoices needed for period ${billingPeriod}.`);
        }

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error during scheduled invoice generation:`, error);
    }
};

/**
 * Функция для запуска планировщика.
 * Расписание: '0 2 1 * *' - означает "в 0 минут 2-го часа 1-го числа каждого месяца".
 */
const startInvoiceScheduler = () => {
    cron.schedule('0 2 1 * *', runMonthlyInvoiceGeneration, {
        scheduled: true,
        timezone: "Asia/Tashkent"
    });
};

module.exports = { startInvoiceScheduler, };