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


// Роут для получения деталей одного урока (без изменений)
router.get('/:id', auth, async (req, res) => {
    try {
        const lesson = await Lesson.findById(req.params.id)
            .select('title assignments group teacher')
            .lean();

        if (!lesson) {
            return res.status(404).json({ message: 'Урок не найден' });
        }

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


// --- ИЗМЕНЕНИЯ ВНЕСЕНЫ В ЭТОТ РОУТ ---
router.post('/', [auth, clearCache], async (req, res) => { 
    try { 
        const { title, dueDate, groupId } = req.body; 
        if (!groupId) return res.status(400).json({ message: "Не указана группа для урока" });
        
        // 1. Создаем и сохраняем новый урок
        const lesson = new Lesson({ title, dueDate, group: groupId, teacher: req.user.userId }); 
        await lesson.save(); 

        // --- НАЧАЛО НОВОЙ ЛОГИКИ: АВТОМАТИЧЕСКАЯ ОЧИСТКА СТАРЫХ УРОКОВ ---
        try {
            const LESSONS_TO_KEEP = 6; // Оставляем 6 самых свежих уроков

            // 2. Находим ID всех уроков в данной группе, отсортированных от самого старого к самому новому.
            // .select('_id') и .lean() делают запрос максимально быстрым и легковесным.
            const allLessonsInGroup = await Lesson.find({ group: groupId })
                .sort({ createdAt: 'asc' })
                .select('_id')
                .lean();

            // 3. Если уроков стало больше, чем нужно хранить...
            if (allLessonsInGroup.length > LESSONS_TO_KEEP) {
                // 4. Определяем, сколько самых старых уроков нужно удалить.
                const lessonsToDeleteCount = allLessonsInGroup.length - LESSONS_TO_KEEP;
                
                // 5. Берем ID самых старых уроков из начала отсортированного массива.
                const idsToDelete = allLessonsInGroup.slice(0, lessonsToDeleteCount).map(l => l._id);

                // 6. Удаляем эти уроки одним эффективным запросом.
                // Оценки (Evaluations) не затрагиваются, так как они в другой коллекции.
                await Lesson.deleteMany({ _id: { $in: idsToDelete } });
            }
        } catch (cleanupError) {
            // Логируем ошибку очистки, но не прерываем основной ответ пользователю.
            // Создание урока прошло успешно, это главное.
            console.error('Ошибка при автоматической очистке старых уроков:', cleanupError);
        }
        // --- КОНЕЦ НОВОЙ ЛОГИКИ ---

        res.status(201).json(lesson); 

    } catch (e) { 
        res.status(500).json({ message: 'Что-то пошло не так' }); 
    } 
});

// --- ОСТАЛЬНЫЕ РОУТЫ БЕЗ ИЗМЕНЕНИЙ ---
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