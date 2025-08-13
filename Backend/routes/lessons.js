const express = require('express');
const router = express.Router();
const Lesson = require('../models/Lesson');
const User = require('../models/User');
const auth = require('../middleware/auth.middleware');
const { cache, clearCache } = require('../middleware/cache.middleware');

// Роут для получения списка уроков (без изменений)
router.get('/', [auth, cache(3600)], async (req, res) => {
    try {
        let lessons;
        const selection = 'title dueDate group teacher createdAt'; 

        if (req.user.role === 'teacher') {
            lessons = await Lesson.find({ teacher: req.user.userId }).select(selection).sort({ createdAt: -1 }).populate('group', 'name');
        } else {
            const student = await User.findById(req.user.userId).select('group');
            if (!student || !student.group) return res.json([]);
            lessons = await Lesson.find({ group: student.group }).select(selection).sort({ createdAt: -1 }).populate('teacher', 'name').populate('group', 'name');
        }
        
        res.json(lessons);
    } catch (e) {
        res.status(500).json({ message: 'Что-то пошло не так' });
    }
});


// --- НОВЫЙ РОУТ: Получение деталей одного урока ---
// Этот роут нужен фронтенду, чтобы получить полный список заданий для модального окна ученика.
router.get('/:id', auth, async (req, res) => {
    try {
        const lesson = await Lesson.findById(req.params.id)
            .select('title assignments group teacher') // Выбираем только необходимые поля
            .lean(); // .lean() для ускорения, т.к. мы только читаем

        if (!lesson) {
            return res.status(404).json({ message: 'Урок не найден' });
        }

        // Проверка доступа: учитель должен быть автором, а ученик - в той же группе
        if (req.user.role === 'teacher') {
            if (lesson.teacher.toString() !== req.user.userId) {
                return res.status(403).json({ message: 'Доступ запрещен' });
            }
        } else { 
            const student = await User.findById(req.user.userId).select('group').lean();
            if (!student.group || lesson.group.toString() !== student.group.toString()) {
                return res.status(403).json({ message: 'Доступ к этому уроку запрещен' });
            }
        }
        
        res.json(lesson);

    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Что-то пошло не так на сервере' });
    }
});


// Роуты на изменение данных (без изменений)
router.post('/', [auth, clearCache], async (req, res) => { 
    try { 
        const { title, dueDate, groupId } = req.body; 
        if (!groupId) return res.status(400).json({ message: "Не указана группа для урока" });
        const lesson = new Lesson({ title, dueDate, group: groupId, teacher: req.user.userId }); 
        await lesson.save(); 
        res.status(201).json(lesson); 
    } catch (e) { res.status(500).json({ message: 'Что-то пошло не так' }); } 
});

router.post('/:id/assignments', [auth, clearCache], async (req, res) => {
    try {
        const lesson = await Lesson.findById(req.params.id);
        if (!lesson) return res.status(404).json({ message: 'Урок не найден' });
        if (lesson.teacher.toString() !== req.user.userId) return res.status(403).json({ message: 'Нет прав' });
        const { title, description } = req.body;
        lesson.assignments.push({ title, description });
        await lesson.save();
        res.status(201).json(lesson);
    } catch (e) { res.status(500).json({ message: 'Что-то пошло не так' }); }
});

router.delete('/:lessonId/assignments/:assignmentId', [auth, clearCache], async (req, res) => {
    try {
        const lesson = await Lesson.findById(req.params.lessonId);
        if (!lesson) return res.status(404).json({ message: 'Урок не найден' });
        if (lesson.teacher.toString() !== req.user.userId) return res.status(403).json({ message: 'Нет прав' });
        lesson.assignments.pull({ _id: req.params.assignmentId });
        await lesson.save();
        res.json(lesson);
    } catch (e) { res.status(500).json({ message: 'Что-то пошло не так' }); }
});

router.put('/:lessonId/assignments/:assignmentId', [auth, clearCache], async (req, res) => {
    try {
        const { title, description } = req.body;
        const lesson = await Lesson.findOneAndUpdate(
            { "_id": req.params.lessonId, "assignments._id": req.params.assignmentId },
            { $set: { "assignments.$.title": title, "assignments.$.description": description, } },
            { new: true }
        );
        if (!lesson) return res.status(404).json({ message: 'Урок или задание не найдено' });
        if (lesson.teacher.toString() !== req.user.userId) return res.status(403).json({ message: 'Нет прав' });
        res.json(lesson);
    } catch (e) { res.status(500).json({ message: 'Что-то пошло не так' }); }
});

module.exports = router;