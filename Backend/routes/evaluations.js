// backend/routes/evaluations.js

const { Router } = require('express');
const auth = require('../middleware/auth.middleware');
const Evaluation = require('../models/Evaluation');
const Lesson = require('../models/Lesson');
const router = Router();

// Роут GET /:lessonId для учителя (без изменений)
router.get('/:lessonId', auth, async (req, res) => {
    try {
        if (req.user.role !== 'teacher') {
            return res.status(403).json({ message: 'Доступ запрещен' });
        }
        const lesson = await Lesson.findById(req.params.lessonId).populate({
            path: 'group',
            populate: { path: 'students', select: 'name' },
        });
        if (!lesson) {
            return res.status(404).json({ message: 'Урок не найден' });
        }
        const evaluations = await Evaluation.find({ lesson: req.params.lessonId });
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
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Что-то пошло не так' });
    }
});

// Роут POST / для учителя (без изменений)
router.post('/', auth, async (req, res) => {
    try {
        if (req.user.role !== 'teacher') {
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
        res.status(200).json(updatedEvaluation);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Что-то пошло не так' });
    }
});


// --- ИЗМЕНЕНИЯ ЗДЕСЬ ---
// GET /api/evaluations/student/:lessonId - Ученик получает свою оценку по уроку
router.get('/student/:lessonId', auth, async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ message: 'Доступ только для студентов' });
        }
        const evaluation = await Evaluation.findOne({
            lesson: req.params.lessonId,
            student: req.user.userId
        }).populate('teacher', 'name');

        if (!evaluation) {
            return res.status(404).json({ message: 'Оценка для этого урока не найдена' });
        }
        
        // 1. Извлекаем ID только тех заданий, которые отмечены как выполненные.
        const completedSkillsIds = evaluation.skills
            .filter(skill => skill.completed)
            .map(skill => skill.assignmentId.toString());
            
        // 2. Формируем новый объект для ответа с правильной структурой.
        const responsePayload = {
            _id: evaluation._id,
            grade: evaluation.grade,
            feedback: evaluation.feedback,
            teacher: evaluation.teacher,
            skills: completedSkillsIds // Отправляем массив ID, который ожидает фронтенд
        };
        
        res.json(responsePayload); // Отправляем обработанные данные

    } catch (e) {
        console.error(e); // Логируем ошибку для отладки
        res.status(500).json({ message: 'Что-то пошло не так' });
    }
});

module.exports = router;