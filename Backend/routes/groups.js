const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const User = require('../models/User');
const Lesson = require('../models/Lesson');
const Evaluation = require('../models/Evaluation'); // Убедитесь, что модель Evaluation существует и импортируется
const auth = require('../middleware/auth.middleware');

const isTeacher = (req, res, next) => {
    if (req.user.role !== 'teacher') {
        return res.status(403).json({ message: 'Доступ разрешен только учителям' });
    }
    next();
};

// --- СОЗДАНИЕ ГРУППЫ (БЕЗ ИЗМЕНЕНИЙ) ---
router.post('/', [auth, isTeacher], async (req, res) => {
    try {
        const { name, description } = req.body;
        const existingGroup = await Group.findOne({ name, teacher: req.user.userId });
        if (existingGroup) {
            return res.status(400).json({ message: `Группа с названием "${name}" уже существует.` });
        }
        const newGroupData = { name, teacher: req.user.userId };
        if (description) newGroupData.description = description;
        const newGroup = new Group(newGroupData);
        await newGroup.save();
        res.status(201).json(newGroup);
    } catch (e) {
        console.error('Group creation error:', e);
        res.status(500).json({ message: 'Ошибка на сервере при создании группы' });
    }
});

// --- ПОЛУЧЕНИЕ ГРУПП УЧИТЕЛЯ (БЕЗ ИЗМЕНЕНИЙ) ---
router.get('/', [auth, isTeacher], async (req, res) => {
    try {
        const groups = await Group.find({ teacher: req.user.userId }).populate('students', 'name email');
        res.json(groups);
    } catch (e) {
        res.status(500).json({ message: 'Что-то пошло не так' });
    }
});

// --- ПОЛУЧЕНИЕ НЕРАСПРЕДЕЛЕННЫХ УЧЕНИКОВ (БЕЗ ИЗМЕНЕНИЙ) ---
router.get('/unassigned', [auth, isTeacher], async (req, res) => {
    try {
        const unassignedStudents = await User.find({ role: 'student', group: null });
        res.json(unassignedStudents);
    } catch (e) {
        res.status(500).json({ message: 'Что-то пошло не так' });
    }
});

// --- НАЗНАЧЕНИЕ УЧЕНИКА В ГРУППУ (БЕЗ ИЗМЕНЕНИЙ) ---
router.put('/:groupId/assign', [auth, isTeacher], async (req, res) => {
    try {
        const { studentId } = req.body;
        const group = await Group.findById(req.params.groupId);
        const student = await User.findById(studentId);
        if (!group || !student) return res.status(404).json({ message: 'Группа или ученик не найдены' });
        if (group.teacher.toString() !== req.user.userId) return res.status(403).json({ message: 'Вы не можете добавлять учеников в эту группу' });
        if (student.group) return res.status(400).json({ message: 'Этот ученик уже состоит в другой группе' });

        group.students.push(studentId);
        student.group = req.params.groupId;
        await group.save();
        await student.save();
        res.json({ message: 'Ученик успешно добавлен в группу' });
    } catch (e) {
        res.status(500).json({ message: 'Что-то пошло не так' });
    }
});

// --- НОВЫЙ МАРШРУТ: УДАЛЕНИЕ УЧЕНИКА ИЗ ГРУППЫ ---
router.delete('/:groupId/students/:studentId', [auth, isTeacher], async (req, res) => {
    try {
        const { groupId, studentId } = req.params;
        const group = await Group.findById(groupId);
        const student = await User.findById(studentId);

        if (!group || !student) {
            return res.status(404).json({ message: 'Группа или ученик не найдены' });
        }
        if (group.teacher.toString() !== req.user.userId) {
            return res.status(403).json({ message: 'У вас нет прав на управление этой группой' });
        }

        // Удаляем ученика из массива в группе
        group.students.pull(studentId);
        // Сбрасываем группу у ученика
        student.group = null;

        await group.save();
        await student.save();

        res.json({ message: 'Ученик успешно удален из группы' });

    } catch (e) {
        console.error('Remove student error:', e);
        res.status(500).json({ message: 'Ошибка на сервере при удалении ученика' });
    }
});

// --- НОВЫЙ МАРШРУТ: УДАЛЕНИЕ ГРУППЫ ---
router.delete('/:groupId', [auth, isTeacher], async (req, res) => {
    try {
        const { groupId } = req.params;
        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ message: 'Группа не найдена' });
        }
        if (group.teacher.toString() !== req.user.userId) {
            return res.status(403).json({ message: 'Вы не можете удалить эту группу' });
        }
        
        // Каскадное удаление:
        // 1. Находим все уроки этой группы
        const lessonsToDelete = await Lesson.find({ group: groupId }).select('_id');
        const lessonIdsToDelete = lessonsToDelete.map(lesson => lesson._id);

        // 2. Удаляем все оценки, связанные с этими уроками
        if (lessonIdsToDelete.length > 0) {
            await Evaluation.deleteMany({ lesson: { $in: lessonIdsToDelete } });
        }

        // 3. Удаляем сами уроки
        await Lesson.deleteMany({ group: groupId });

        // 4. Убираем ссылку на группу у всех студентов в этой группе
        await User.updateMany({ _id: { $in: group.students } }, { $set: { group: null } });

        // 5. Удаляем саму группу
        await Group.findByIdAndDelete(groupId);

        res.json({ message: 'Группа, а также все ее уроки и оценки были успешно удалены.' });

    } catch (e) {
        console.error('Delete group error:', e);
        res.status(500).json({ message: 'Ошибка на сервере при удалении группы' });
    }
});


module.exports = router;