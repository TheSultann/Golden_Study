const express = require('express');
const router = express.Router();
const Lesson = require('../models/Lesson');
const User = require('../models/User');
const auth = require('../middleware/auth.middleware');
const { cache, clearCache } = require('../middleware/cache.middleware');
const asyncHandler = require('../utils/asyncHandler'); // --- 1. ИМПОРТИРУЕМ ОБЕРТКУ ---

// --- 2. ОБОРАЧИВАЕМ РОУТЫ В asyncHandler И УБИРАЕМ try...catch ---

router.get('/', [auth, cache(3600)], asyncHandler(async (req, res) => {
    let lessons;
    const selection = 'title dueDate group teacher createdAt'; 
    if (req.user.role === 'teacher' || req.user.role === 'admin') {
        lessons = await Lesson.find({ teacher: req.user.userId })
            .select(selection)
            .sort({ createdAt: -1 })
            .populate('group', 'name')
            .lean();
    } else { 
        const student = await User.findById(req.user.userId).select('group').lean();
        if (!student || !student.group) return res.json([]);
        lessons = await Lesson.find({ group: student.group })
            .select(selection)
            .sort({ createdAt: -1 })
            .populate('teacher', 'name')
            .populate('group', 'name')
            .lean();
    }
    res.json(lessons);
}));

router.get('/:id', auth, asyncHandler(async (req, res) => {
    const lesson = await Lesson.findById(req.params.id).select('title assignments group teacher').lean();
    if (!lesson) {
        return res.status(404).json({ message: 'Урок не найден' });
    }
    if (req.user.role === 'teacher' && lesson.teacher.toString() !== req.user.userId) {
        return res.status(403).json({ message: 'Доступ запрещен' });
    } else if (req.user.role === 'student') {
        const student = await User.findById(req.user.userId).select('group').lean();
        if (!student.group || lesson.group.toString() !== student.group.toString()) {
            return res.status(403).json({ message: 'Доступ к этому уроку запрещен' });
        }
    }
    res.json(lesson);
}));

router.post('/', [auth, auth.teacherOrAdmin, clearCache], asyncHandler(async (req, res) => { 
    const { title, dueDate, groupId } = req.body; 
    if (!groupId) return res.status(400).json({ message: "Не указана группа для урока" });
    
    const lesson = new Lesson({ title, dueDate, group: groupId, teacher: req.user.userId }); 
    await lesson.save(); 

    // Вложенный try...catch для некритичной операции оставляем, чтобы основная не падала
    try {
        const LESSONS_TO_KEEP = 6;
        const allLessonsInGroup = await Lesson.find({ group: groupId }).sort({ createdAt: 'asc' }).select('_id').lean();
        if (allLessonsInGroup.length > LESSONS_TO_KEEP) {
            const lessonsToDeleteCount = allLessonsInGroup.length - LESSONS_TO_KEEP;
            const idsToDelete = allLessonsInGroup.slice(0, lessonsToDeleteCount).map(l => l._id);
            await Lesson.deleteMany({ _id: { $in: idsToDelete } });
        }
    } catch (cleanupError) {
        console.error('Ошибка при автоматической очистке старых уроков:', cleanupError);
    }

    res.status(201).json(lesson); 
}));

router.delete('/:lessonId', [auth, auth.teacherOrAdmin, clearCache], asyncHandler(async (req, res) => {
    const { lessonId } = req.params;
    const lesson = await Lesson.findById(lessonId);

    if (!lesson) {
        return res.status(404).json({ message: 'Урок не найден' });
    }

    if (req.user.role === 'teacher' && lesson.teacher.toString() !== req.user.userId) {
        return res.status(403).json({ message: 'У вас нет прав на удаление этого урока' });
    }

    await Lesson.findByIdAndDelete(lessonId);
    res.json({ message: 'Урок успешно удален' });
}));

router.post('/:id/assignments', [auth, auth.teacherOrAdmin, clearCache], asyncHandler(async (req, res) => {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) return res.status(404).json({ message: 'Урок не найден' });
    if (lesson.teacher.toString() !== req.user.userId) return res.status(403).json({ message: 'Нет прав' });
    
    const { title, description } = req.body;
    lesson.assignments.push({ title, description });
    await lesson.save();
    res.status(201).json(lesson);
}));

router.delete('/:lessonId/assignments/:assignmentId', [auth, auth.teacherOrAdmin, clearCache], asyncHandler(async (req, res) => {
    const lesson = await Lesson.findById(req.params.lessonId);
    if (!lesson) return res.status(404).json({ message: 'Урок не найден' });
    if (lesson.teacher.toString() !== req.user.userId) return res.status(403).json({ message: 'Нет прав' });
    
    lesson.assignments.pull({ _id: req.params.assignmentId });
    await lesson.save();
    res.json(lesson);
}));

router.put('/:lessonId/assignments/:assignmentId', [auth, auth.teacherOrAdmin, clearCache], asyncHandler(async (req, res) => {
    const { title, description } = req.body;
    const lesson = await Lesson.findOneAndUpdate(
        { "_id": req.params.lessonId, "assignments._id": req.params.assignmentId, "teacher": req.user.userId },
        { $set: { "assignments.$.title": title, "assignments.$.description": description } },
        { new: true }
    );
    if (!lesson) return res.status(404).json({ message: 'Урок или задание не найдено, или у вас нет прав' });
    res.json(lesson);
}));

module.exports = router;