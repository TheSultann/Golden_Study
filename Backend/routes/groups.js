const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const User = require('../models/User');
const Lesson = require('../models/Lesson');
const Evaluation = require('../models/Evaluation');
const auth = require('../middleware/auth.middleware');
const { cache, clearCache } = require('../middleware/cache.middleware');

const isTeacher = (req, res, next) => {
    if (req.user.role !== 'teacher') {
        return res.status(403).json({ message: 'Доступ разрешен только учителям' });
    }
    next();
};

// Получить группы учителя (кэш)
router.get('/', [auth, isTeacher, cache(3600)], async (req, res) => {
    try {
        const groups = await Group.find({ teacher: req.user.userId })
            .populate('students', 'name email')
            .lean();
        res.json(groups);
    } catch {
        res.status(500).json({ message: 'Что-то пошло не так' });
    }
});

// Получить учеников без группы (кэш)
router.get('/unassigned', [auth, isTeacher, cache(3600)], async (req, res) => {
    try {
        const unassignedStudents = await User.find({ role: 'student', group: null }).lean();
        res.json(unassignedStudents);
    } catch {
        res.status(500).json({ message: 'Что-то пошло не так' });
    }
});

// Создать группу
router.post('/', [auth, isTeacher, clearCache], async (req, res) => {
    try {
        const { name, description } = req.body;
        const existingGroup = await Group.findOne({ name, teacher: req.user.userId }).lean();
        if (existingGroup) {
            return res.status(400).json({ message: `Группа с названием "${name}" уже существует.` });
        }
        const newGroup = new Group({
            name,
            teacher: req.user.userId,
            ...(description && { description })
        });
        await newGroup.save();
        res.status(201).json(newGroup);
    } catch (e) {
        console.error('Group creation error:', e);
        res.status(500).json({ message: 'Ошибка на сервере при создании группы' });
    }
});

// Добавить ученика в группу (оптимизировано)
router.put('/:groupId/assign', [auth, isTeacher, clearCache], async (req, res) => {
    try {
        const { studentId } = req.body;

        // Добавляем ученика в группу
        const group = await Group.findOneAndUpdate(
            { _id: req.params.groupId, teacher: req.user.userId },
            { $addToSet: { students: studentId } },
            { new: true }
        ).lean();

        if (!group) return res.status(404).json({ message: 'Группа не найдена или доступ запрещен' });

        // Привязываем группу к ученику
        const updated = await User.updateOne(
            { _id: studentId, group: null },
            { $set: { group: req.params.groupId } }
        );

        if (updated.matchedCount === 0) {
            return res.status(400).json({ message: 'Этот ученик уже состоит в другой группе' });
        }

        res.json({ message: 'Ученик успешно добавлен в группу' });
    } catch (e) {
        console.error('Assign student error:', e);
        res.status(500).json({ message: 'Ошибка на сервере' });
    }
});

// Удалить ученика из группы (оптимизировано)
router.delete('/:groupId/students/:studentId', [auth, isTeacher, clearCache], async (req, res) => {
    try {
        const { groupId, studentId } = req.params;

        const group = await Group.findOneAndUpdate(
            { _id: groupId, teacher: req.user.userId },
            { $pull: { students: studentId } },
            { new: true }
        ).lean();

        if (!group) {
            return res.status(404).json({ message: 'Группа не найдена или доступ запрещен' });
        }

        await User.updateOne({ _id: studentId }, { $set: { group: null } });

        res.json({ message: 'Ученик успешно удален из группы' });
    } catch (e) {
        console.error('Remove student error:', e);
        res.status(500).json({ message: 'Ошибка на сервере при удалении ученика' });
    }
});

// Удалить группу
router.delete('/:groupId', [auth, isTeacher, clearCache], async (req, res) => {
    try {
        const { groupId } = req.params;
        const group = await Group.findById(groupId).lean();

        if (!group) {
            return res.status(404).json({ message: 'Группа не найдена' });
        }
        if (group.teacher.toString() !== req.user.userId) {
            return res.status(403).json({ message: 'Вы не можете удалить эту группу' });
        }

        // Удаляем все уроки и оценки
        const lessonIdsToDelete = (await Lesson.find({ group: groupId }).select('_id').lean())
            .map(lesson => lesson._id);

        if (lessonIdsToDelete.length > 0) {
            await Evaluation.deleteMany({ lesson: { $in: lessonIdsToDelete } });
        }

        await Lesson.deleteMany({ group: groupId });
        await User.updateMany({ _id: { $in: group.students } }, { $set: { group: null } });
        await Group.findByIdAndDelete(groupId);

        res.json({ message: 'Группа и связанные данные успешно удалены.' });
    } catch (e) {
        console.error('Delete group error:', e);
        res.status(500).json({ message: 'Ошибка на сервере при удалении группы' });
    }
});

module.exports = router;
