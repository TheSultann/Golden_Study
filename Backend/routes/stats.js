const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');
const Evaluation = require('../models/Evaluation');
const User = require('../models/User');
const Lesson = require('../models/Lesson');
const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');

router.get('/group/:groupId', auth, asyncHandler(async (req, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Access denied' });
    }
    const { groupId } = req.params;
    const groupIdObj = new mongoose.Types.ObjectId(groupId);

    const studentsInGroup = await User.find({ group: groupIdObj }).select('_id').lean();
    const studentIds = studentsInGroup.map(s => s._id);

    if (studentIds.length === 0) {
        return res.json({ studentStats: [], groupAverage: 0 });
    }

    const [studentStatsResult, groupAverageResult] = await Promise.all([
        Evaluation.aggregate([
            { $match: { student: { $in: studentIds } } },
            { $sort: { createdAt: -1 } },
            { $group: { _id: '$student', averageGrade: { $avg: '$grade' }, lessonCount: { $sum: 1 }, lastGrade: { $first: '$grade' } } },
            { $lookup: { from: User.collection.name, localField: '_id', foreignField: '_id', as: 'studentInfo' } },
            { $unwind: '$studentInfo' },
            { $project: { _id: 0, studentId: '$_id', studentName: '$studentInfo.name', averageGrade: { $round: ['$averageGrade', 1] }, lessonCount: 1, lastGrade: 1 } },
            { $sort: { averageGrade: -1 } }
        ]),
        Evaluation.aggregate([
            { $match: { student: { $in: studentIds } } },
            { $group: { _id: null, averageGrade: { $avg: '$grade' } } },
            { $project: { _id: 0, averageGrade: { $round: [{ $ifNull: ['$averageGrade', 0] }, 1] } } }
        ])
    ]);

    const rankedStats = studentStatsResult.map((stat, index) => ({ ...stat, rank: index + 1 }));
    const groupAverage = groupAverageResult.length > 0 ? groupAverageResult[0].averageGrade : 0;

    res.json({
        studentStats: rankedStats,
        groupAverage: groupAverage 
    });
}));

router.get('/student', auth, asyncHandler(async (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ msg: 'Access denied' });
    }
    const studentId = new mongoose.Types.ObjectId(req.user.userId);
    
    const user = await User.findById(studentId).select('group').lean();
    if (!user || !user.group) {
        return res.status(404).json({ msg: 'You are not in a group' });
    }

    const studentsInMyGroup = await User.find({ group: user.group }).select('_id').lean();
    const studentIdsInMyGroup = studentsInMyGroup.map(s => s._id);

    const [myEvaluations, groupStats] = await Promise.all([
        Evaluation.aggregate([
            { $match: { student: studentId } },
            { $sort: { createdAt: -1 } },
            { $lookup: { from: Lesson.collection.name, localField: 'lesson', foreignField: '_id', as: 'lessonInfo' } },
            { $unwind: '$lessonInfo' },
            { $project: { lessonId: '$lesson', lessonTitle: '$lessonInfo.title', grade: 1, evaluationDate: '$createdAt' } }
        ]),
        Evaluation.aggregate([
            { $match: { student: { $in: studentIdsInMyGroup } } },
            { $group: { _id: '$student', averageGrade: { $avg: '$grade' } } },
            { $sort: { averageGrade: -1 } },
            { $lookup: { from: User.collection.name, localField: '_id', foreignField: '_id', as: 'studentInfo' } },
            { $unwind: '$studentInfo' },
            { $project: { _id: 0, studentId: '$_id', studentName: '$studentInfo.name', averageGrade: { $round: ['$averageGrade', 1] } } }
        ])
    ]);
    
    const rankedGroupStats = groupStats.map((stat, index) => ({ ...stat, rank: index + 1 }));
    const myRank = rankedGroupStats.find(s => s.studentId.toString() === req.user.userId);
    
    // --- ИЗМЕНЕНИЕ: Отправляем полный рейтинг, а не топ-5 ---
    const fullRanking = rankedGroupStats.map(stat => ({
        ...stat,
        isCurrentUser: stat.studentId.toString() === req.user.userId
    }));
    
    const groupAverageRaw = rankedGroupStats.length > 0 ? rankedGroupStats.reduce((acc, curr) => acc + curr.averageGrade, 0) / rankedGroupStats.length : 0;
    const groupAverage = Math.round(groupAverageRaw * 10) / 10;

    res.json({
        myEvaluations,
        rating: {
            myRank,
            groupAverage: groupAverage,
            totalStudents: rankedGroupStats.length,
            fullRanking // Отправляем полный массив вместо top5
        }
    });
}));

module.exports = router;