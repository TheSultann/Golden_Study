// backend/routes/lessons.js

const express = require('express');
const router = express.Router();
const Lesson = require('../models/Lesson');
const User = require('../models/User'); 
const auth = require('../middleware/auth.middleware');

// Роуты POST, DELETE, PUT без изменений...
router.post('/', auth, async (req, res) => { try { const { title, dueDate, groupId } = req.body; if (!groupId) { return res.status(400).json({ message: "Не указана группа для урока" }); } const lesson = new Lesson({ title, dueDate, group: groupId, teacher: req.user.userId }); await lesson.save(); res.status(201).json(lesson); } catch (e) { res.status(500).json({ message: 'Что-то пошло не так' }); } });

// --- ГЛАВНОЕ ИЗМЕНЕНИЕ ЗДЕСЬ ---
router.get('/', auth, async (req, res) => { 
    try { 
        let lessons; 
        if (req.user.role === 'teacher') { 
            lessons = await Lesson.find({ teacher: req.user.userId }).sort({ createdAt: -1 }).populate('group', 'name'); 
        } else { 
            const student = await User.findById(req.user.userId); 
            if (!student.group) { 
                return res.json([]); 
            } 
            // ДОБАВЛЕНО .populate('group', 'name') ДЛЯ ПОДГРУЗКИ НАЗВАНИЯ ГРУППЫ
            lessons = await Lesson.find({ group: student.group })
                .sort({ createdAt: -1 })
                .populate('teacher', 'name')
                .populate('group', 'name'); // <--- ВОТ ИСПРАВЛЕНИЕ
        } 
        res.json(lessons); 
    } catch (e) { 
        res.status(500).json({ message: 'Что-то пошло не так' }); 
    } 
});

router.post('/:id/assignments', auth, async (req, res) => {
    try {
        const lesson = await Lesson.findById(req.params.id);
        if (!lesson) { return res.status(404).json({ message: 'Урок не найден' }); }
        if (lesson.teacher.toString() !== req.user.userId) { return res.status(403).json({ message: 'Нет прав' }); }
        const { title, description } = req.body;
        lesson.assignments.push({ title, description });
        await lesson.save();
        res.status(201).json(lesson);
    } catch (e) {
        res.status(500).json({ message: 'Что-то пошло не так' });
    }
});

router.delete('/:lessonId/assignments/:assignmentId', auth, async (req, res) => {
    try {
        const lesson = await Lesson.findById(req.params.lessonId);
        if (!lesson) { return res.status(404).json({ message: 'Урок не найден' }); }
        if (lesson.teacher.toString() !== req.user.userId) { return res.status(403).json({ message: 'Нет прав' }); }
        lesson.assignments.pull({ _id: req.params.assignmentId });
        await lesson.save();
        res.json(lesson);
    } catch (e) {
        res.status(500).json({ message: 'Что-то пошло не так' });
    }
});

router.put('/:lessonId/assignments/:assignmentId', auth, async (req, res) => {
    try {
        const { title, description } = req.body;
        const lesson = await Lesson.findOneAndUpdate(
            { "_id": req.params.lessonId, "assignments._id": req.params.assignmentId },
            { $set: { "assignments.$.title": title, "assignments.$.description": description, } },
            { new: true } 
        );
        if (!lesson) {
            return res.status(404).json({ message: 'Урок или задание не найдено' });
        }
        if (lesson.teacher.toString() !== req.user.userId) {
            return res.status(403).json({ message: 'Нет прав' });
        }
        res.json(lesson);
    } catch (e) {
        res.status(500).json({ message: 'Что-то пошло не так' });
    }
});

module.exports = router;