// Backend/routes/student.js

const { Router } = require('express');
const mongoose = require('mongoose');
const authMiddleware = require('../middleware/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const Evaluation = require('../models/Evaluation');
const Attendance = require('../models/Attendance');
const TuitionPayment = require('../models/TuitionPayment');

const router = Router();

router.get('/:id/profile', authMiddleware, asyncHandler(async (req, res) => {
    const studentId = req.params.id;
    const { role } = req.user;

    if (role !== 'teacher' && role !== 'admin') {
        return res.status(403).json({ message: 'Access denied   ' });
    }

    const student = await User.findById(studentId).select('name email createdAt').lean();
    if (!student) {
        return res.status(404).json({ message: 'Student not found' });
    }

    // Исправлена сортировка по полю createdAt, которое добавляется Mongoose
    const evaluations = await Evaluation.find({ student: studentId })
        .sort({ createdAt: -1 })
        .populate('lesson', 'title')
        .select('grade createdAt lesson feedback')
        .lean();

    let averageGrade = 0;
    if (evaluations.length > 0) {
        const totalGrade = evaluations.reduce((sum, eval) => sum + eval.grade, 0);
        averageGrade = (totalGrade / evaluations.length).toFixed(1);
    }
    
    const progressData = evaluations.slice(0, 7).reverse().map(e => ({
        lesson: e.lesson.title,
        grade: e.grade,
        date: e.createdAt
    }));

    const attendanceRecords = await Attendance.find({ student: studentId }).select('date status').lean();
    const totalLessonsAttended = attendanceRecords.filter(r => r.status === 'present').length;
    const totalLessonsTracked = attendanceRecords.length;
    const attendancePercentage = totalLessonsTracked > 0 ? Math.round((totalLessonsAttended / totalLessonsTracked) * 100) : 0;

    // --- ИСПРАВЛЕННЫЙ БЛОК ФИНАНСОВ ---
    const now = new Date();
    // Форматируем текущий месяц в 'YYYY-MM' для соответствия модели
    const currentBillingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const payment = await TuitionPayment.findOne({
        student: studentId,
        billingPeriod: currentBillingPeriod
    }).select('status amountDue').lean();

    let financialStatus = { status: 'no_invoice', message: 'Счет не выставлен', details: null };
    if (payment) {
        const amountFormatted = `${payment.amountDue} у.е.`; // Используем amountDue

        switch (payment.status) {
            case 'paid':
                financialStatus = {
                    status: 'paid',
                    message: `Paid`,
                    details: `Amount: ${amountFormatted}`
                };
                break;
            case 'overdue':
                financialStatus = {
                    status: 'overdue',
                    message: 'Overdue',
                    details: `Amount due: ${amountFormatted}`
                };
                break;
            case 'unpaid':
            default:
                financialStatus = {
                    status: 'pending', // Используем 'pending' для соответствия фронтенду
                    message: 'Pending payment',
                    details: `Amount due: ${amountFormatted}`
                };
                break;
        }
    }
    // --- КОНЕЦ ИСПРАВЛЕННОГО БЛОКА ---

    const profile = {
        ...student,
        keyMetrics: {
            averageGrade: parseFloat(averageGrade),
            attendance: {
                percentage: attendancePercentage,
                present: totalLessonsAttended,
                total: totalLessonsTracked
            },
            financialStatus,
        },
        detailedData: {
            evaluations,
            progressChart: progressData,
            attendanceCalendar: attendanceRecords.map(r => ({ date: r.date, status: r.status })),
        }
    };

    res.status(200).json(profile);
}));

module.exports = router;