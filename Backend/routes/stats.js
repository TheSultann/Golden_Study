// backend/routes/stats.js

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');
const Evaluation = require('../models/Evaluation');
const User = require('../models/User');
const Lesson = require('../models/Lesson');
const mongoose = require('mongoose');

// Роут для учителя
router.get('/group/:groupId', auth, async (req, res) => {
    try {
        if (req.user.role !== 'teacher') {
            return res.status(403).json({ msg: 'Access denied' });
        }
        const { groupId } = req.params;
        const groupIdObj = new mongoose.Types.ObjectId(groupId);

        // --- ИЗМЕНЕНИЕ: Находим студентов группы напрямую, это быстрее ---
        const studentsInGroup = await User.find({ group: groupIdObj }).select('_id');
        const studentIds = studentsInGroup.map(s => s._id);

        if (studentIds.length === 0) {
            return res.json([]);
        }

        // Агрегация остается такой же, но работает по заранее найденному списку студентов
        const stats = await Evaluation.aggregate([
            { $match: { student: { $in: studentIds } } },
            { $sort: { createdAt: -1 } },
            { $group: { _id: '$student', averageGrade: { $avg: '$grade' }, lessonCount: { $sum: 1 }, lastGrade: { $first: '$grade' }, } },
            { $lookup: { from: User.collection.name, localField: '_id', foreignField: '_id', as: 'studentInfo' } },
            { $unwind: '$studentInfo' },
            { $project: { _id: 0, studentId: '$_id', studentName: '$studentInfo.name', averageGrade: { $round: ['$averageGrade', 0] }, lessonCount: 1, lastGrade: 1 } },
            { $sort: { averageGrade: -1 } }
        ]);

        const rankedStats = stats.map((stat, index) => ({ ...stat, rank: index + 1 }));
        res.json(rankedStats);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


// Роут для ученика
router.get('/student', auth, async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ msg: 'Access denied' });
        }
        const studentId = new mongoose.Types.ObjectId(req.user.userId);
        
        // --- ИЗМЕНЕНИЕ: Делаем один запрос, чтобы получить группу студента ---
        const user = await User.findById(studentId).select('group').lean();
        if (!user || !user.group) {
            return res.status(404).json({ msg: 'You are not in a group' });
        }

        const [myEvaluations, groupStats] = await Promise.all([
            // Запрос для личных оценок ученика
            Evaluation.aggregate([
                { $match: { student: studentId } },
                { $sort: { createdAt: -1 } },
                { $lookup: { from: Lesson.collection.name, localField: 'lesson', foreignField: '_id', as: 'lessonInfo' } },
                { $unwind: '$lessonInfo' },
                { $project: { lessonId: '$lesson', lessonTitle: '$lessonInfo.title', grade: 1, evaluationDate: '$createdAt' } }
            ]),
            // Запрос для статистики по всей группе
            Evaluation.aggregate([
                { $match: { student: { $in: (await User.find({ group: user.group }).select('_id')).map(s => s._id) } } },
                { $group: { _id: '$student', averageGrade: { $avg: '$grade' } } },
                { $sort: { averageGrade: -1 } },
                { $lookup: { from: User.collection.name, localField: '_id', foreignField: '_id', as: 'studentInfo' } },
                { $unwind: '$studentInfo' },
                { $project: { _id: 0, studentId: '$_id', studentName: '$studentInfo.name', averageGrade: { $round: ['$averageGrade', 0] } } }
            ])
        ]);
        
        const rankedGroupStats = groupStats.map((stat, index) => ({ ...stat, rank: index + 1 }));
        const myRank = rankedGroupStats.find(s => s.studentId.toString() === req.user.userId);
        const top5 = rankedGroupStats.slice(0, 5);
        const groupAverage = rankedGroupStats.length > 0 ? rankedGroupStats.reduce((acc, curr) => acc + curr.averageGrade, 0) / rankedGroupStats.length : 0;

        res.json({
            myEvaluations,
            rating: {
                myRank,
                groupAverage: Math.round(groupAverage),
                totalStudents: rankedGroupStats.length,
                top5
            }
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;