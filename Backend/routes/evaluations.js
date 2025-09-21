const { Router } = require('express');
const auth = require('../middleware/auth.middleware');
const Evaluation = require('../models/Evaluation');
const Lesson = require('../models/Lesson');
const router = Router();
const redisClient = require('../redis-client');
const asyncHandler = require('../utils/asyncHandler'); // --- 1. ИМПОРТИРУЕМ ОБЕРТКУ ---

// --- 2. ОБОРАЧИВАЕМ РОУТЫ В asyncHandler И УБИРАЕМ try...catch ---

// Роут GET /:lessonId для учителя и администратора
router.get('/:lessonId', auth, asyncHandler(async (req, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Доступ запрещен' });
    }
    const lesson = await Lesson.findById(req.params.lessonId).populate({
        path: 'group',
        populate: { path: 'students', select: 'name' },
    }).lean(); // Добавляем .lean() для производительности
    
    if (!lesson) {
        return res.status(404).json({ message: 'Урок не найден' });
    }
    
    const evaluations = await Evaluation.find({ lesson: req.params.lessonId }).lean(); // Добавляем .lean()
    const evaluationsMap = new Map();
    evaluations.forEach((ev) => evaluationsMap.set(ev.student.toString(), ev));
    
    const results = lesson.group.students.map(student => {
        const savedEvaluation = evaluationsMap.get(student._id.toString());
        const savedSkillsMap = new Map();
        if (savedEvaluation) {
            savedEvaluation.skills.forEach(skill => {
                savedSkillsMap.set(skill.assignmentId.toString(), skill.completed);
            });
        }
        const actualSkills = lesson.assignments.map(assign => ({
            assignmentId: assign._id,
            assignmentTitle: assign.title,
            completed: savedSkillsMap.get(assign._id.toString()) || false,
        }));
        const finalEvaluation = {
            grade: savedEvaluation?.grade || 0,
            skills: actualSkills,
        };
        return { student: student, evaluation: finalEvaluation };
    });
    res.json(results);
}));

// Роут POST / для учителя и администратора
router.post('/', auth, asyncHandler(async (req, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Доступ запрещен' });
    }
    const { lessonId, studentId, grade, skills, feedback } = req.body;
    const evaluationData = {
        lesson: lessonId,
        student: studentId,
        teacher: req.user.userId,
        grade,
        skills,
        feedback,
    };
    const updatedEvaluation = await Evaluation.findOneAndUpdate(
        { lesson: lessonId, student: studentId },
        evaluationData,
        { new: true, upsert: true }
    );

    const overviewCacheKey = 'cache:GET:/api/overview/teachers';
    if (redisClient.isOpen) {
        await redisClient.del(overviewCacheKey);
        console.log(`CACHE CLEARED: ${overviewCacheKey}`);
    }

    res.status(200).json(updatedEvaluation);
}));


// GET /api/evaluations/student/:lessonId - Ученик получает свою оценку по уроку
router.get('/student/:lessonId', auth, asyncHandler(async (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ message: 'Доступ только для студентов' });
    }
    const evaluation = await Evaluation.findOne({
        lesson: req.params.lessonId,
        student: req.user.userId
    }).populate('teacher', 'name').lean(); // Добавляем .lean()

    if (!evaluation) {
        return res.status(404).json({ message: 'Оценка для этого урока не найдена' });
    }
    
    const completedSkillsIds = evaluation.skills
        .filter(skill => skill.completed)
        .map(skill => skill.assignmentId.toString());
        
    const responsePayload = {
        _id: evaluation._id,
        grade: evaluation.grade,
        feedback: evaluation.feedback,
        teacher: evaluation.teacher,
        skills: completedSkillsIds
    };
    
    res.json(responsePayload);
}));

module.exports = router;