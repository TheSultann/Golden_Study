// backend/routes/stats.js

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');
const Group = require('../models/Group');
const Evaluation = require('../models/Evaluation');
const User = require('../models/User');
const Lesson = require('../models/Lesson');
const mongoose = require('mongoose');

// Роут для учителя (без изменений)
router.get('/group/:groupId', auth, async (req, res) => {
    try {
        if (req.user.role !== 'teacher') {
            return res.status(403).json({ msg: 'Access denied' });
        }
        const { groupId } = req.params;
        const group = await Group.findById(groupId);
        if (!group || group.teacher.toString() !== req.user.userId) {
            return res.status(404).json({ msg: 'Group not found or you are not the teacher' });
        }
        const studentIds = group.students;
        if (studentIds.length === 0) {
            return res.json([]);
        }
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
        const user = await User.findById(studentId);
        if (!user || !user.group) {
            return res.status(404).json({ msg: 'You are not in a group' });
        }

        // --- ИЗМЕНЕНИЕ ЗДЕСЬ: ДОБАВЛЕНА ДАТА ОЦЕНКИ ---
        const myEvaluations = await Evaluation.aggregate([
            { $match: { student: studentId } },
            { $sort: { createdAt: -1 } }, // Сортируем по дате оценки, чтобы новые были сверху
            { $lookup: { from: Lesson.collection.name, localField: 'lesson', foreignField: '_id', as: 'lessonInfo' } },
            { $unwind: '$lessonInfo' },
            { 
                $project: { 
                    lessonId: '$lesson', 
                    lessonTitle: '$lessonInfo.title', 
                    grade: 1,
                    evaluationDate: '$createdAt' // Добавляем дату создания оценки
                } 
            }
        ]);

        const group = await Group.findById(user.group);
        if (!group) {
            return res.status(404).json({ msg: 'Group data not found' });
        }
        const studentIdsInGroup = group.students;

        const groupStats = await Evaluation.aggregate([
            { $match: { student: { $in: studentIdsInGroup } } },
            { $group: { _id: '$student', averageGrade: { $avg: '$grade' } } },
            { $sort: { averageGrade: -1 } },
            { $group: { _id: null, students: { $push: { studentId: '$_id', averageGrade: '$averageGrade', } } } },
            { $unwind: { path: '$students', includeArrayIndex: 'rank' } },
            { $lookup: { from: User.collection.name, localField: 'students.studentId', foreignField: '_id', as: 'studentInfo' } },
            { $unwind: '$studentInfo' },
            { $project: { _id: 0, studentId: '$students.studentId', studentName: '$studentInfo.name', averageGrade: { $round: ['$students.averageGrade', 0] }, rank: { $add: ['$rank', 1] } } }
        ]);
        
        const myRank = groupStats.find(s => s.studentId.toString() === req.user.userId);
        const top5 = groupStats.slice(0, 5);
        const groupAverage = groupStats.length > 0 ? groupStats.reduce((acc, curr) => acc + curr.averageGrade, 0) / groupStats.length : 0;

        res.json({
            myEvaluations,
            rating: {
                myRank,
                groupAverage: Math.round(groupAverage),
                totalStudents: groupStats.length,
                top5
            }
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;