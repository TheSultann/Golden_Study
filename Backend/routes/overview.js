const { Router } = require('express');
const router = Router();
const auth = require('../middleware/auth.middleware');
const Group = require('../models/Group');
const User = require('../models/User');
const Evaluation = require('../models/Evaluation');
const mongoose = require('mongoose');
const redisClient = require('../redis-client');
const asyncHandler = require('../utils/asyncHandler');

router.use(auth, auth.adminOnly);

router.get('/teachers', asyncHandler(async (req, res) => {
    const cacheKey = `cache:GET:${req.originalUrl}`;
    if (redisClient.isOpen) {
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            console.log(`CACHE HIT: ${cacheKey}`);
            return res.json(JSON.parse(cachedData));
        }
    }
    console.log(`CACHE MISS: ${cacheKey}`);

    const teachingStaff = await User.find({ 
        role: { $in: ['teacher', 'admin'] } 
    }).select('_id name').lean();
    
    const teacherIds = teachingStaff.map(t => t._id);

    const groupStats = await Group.aggregate([
        { 
            $match: { 
                teacher: { $in: teacherIds },
                status: 'active'
            } 
        },
        {
            $lookup: {
                from: 'evaluations',
                localField: 'students',
                foreignField: 'student',
                as: 'evaluations'
            }
        },
        {
            $addFields: {
                studentCount: { $size: '$students' },
                averageGrade: { $avg: '$evaluations.grade' }
            }
        },
        {
            $group: {
                _id: '$teacher',
                groups: {
                    $push: {
                        _id: '$_id',
                        name: '$name',
                        studentCount: '$studentCount',
                        averageGrade: { $round: [{ $ifNull: ['$averageGrade', 0] }, 1] }
                    }
                }
            }
        }
    ]);

    const teacherStatsMap = new Map(groupStats.map(item => [item._id.toString(), item.groups]));

    const overviewData = teachingStaff.map(staffMember => {
        const groups = teacherStatsMap.get(staffMember._id.toString()) || [];
        const totalStudents = groups.reduce((sum, group) => sum + group.studentCount, 0);
        const validGradesGroups = groups.filter(g => g.averageGrade > 0);
        
        const overallAverageGradeRaw = validGradesGroups.length > 0
            ? validGradesGroups.reduce((sum, group) => sum + group.averageGrade, 0) / validGradesGroups.length
            : 0;
        const overallAverageGrade = Math.round(overallAverageGradeRaw * 10) / 10;

        return {
            ...staffMember,
            groups,
            groupCount: groups.length,
            totalStudents,
            overallAverageGrade
        };
    });

    if (redisClient.isOpen) {
        redisClient.setEx(cacheKey, 3600, JSON.stringify(overviewData));
    }

    res.json(overviewData);
}));

module.exports = router;