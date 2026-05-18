const { Router } = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');
const Attendance = require('../models/Attendance');
const Lesson = require('../models/Lesson');
const router = Router();

function canManageLessonAttendance(user, lesson) {
    if (user.role === 'admin') {
        return true;
    }

    return user.role === 'teacher' && lesson.teacher.toString() === user.userId;
}

// GET /api/attendance/:lessonId
// Получает список студентов урока и их текущий статус посещаемости
router.get('/:lessonId', authMiddleware, asyncHandler(async (req, res) => {
    const { lessonId } = req.params;

    const lesson = await Lesson.findById(lessonId).populate({
        path: 'group',
        select: 'students',
        populate: {
            path: 'students',
            select: 'name avatar'
        }
    });

    if (!lesson) {
        return res.status(404).json({ message: 'Урок не найден' });
    }

    if (!canManageLessonAttendance(req.user, lesson)) {
        return res.status(403).json({ message: 'Access denied' });
    }

    const studentIds = lesson.group.students.map(s => s._id);
    const attendanceRecords = await Attendance.find({ lesson: lessonId, student: { $in: studentIds } });

    const attendanceMap = new Map();
    attendanceRecords.forEach(record => {
        attendanceMap.set(record.student.toString(), record.status);
    });

    const studentsWithStatus = lesson.group.students.map(student => ({
        _id: student._id,
        name: student.name,
        avatar: student.avatar,
        status: attendanceMap.get(student._id.toString()) || null // null, если отметки еще нет
    }));

    res.status(200).json(studentsWithStatus);
}));


// POST /api/attendance/:lessonId
// Сохраняет или обновляет данные о посещаемости для всего урока
router.post('/:lessonId', authMiddleware, asyncHandler(async (req, res) => {
    const { lessonId } = req.params;
    const { presentStudentIds } = req.body; // Массив ID присутствующих студентов
    const teacherId = req.user.userId;

    if (!Array.isArray(presentStudentIds)) {
        return res.status(400).json({ message: 'presentStudentIds must be an array' });
    }

    const lesson = await Lesson.findById(lessonId).populate('group');
    if (!lesson) {
        return res.status(404).json({ message: 'Урок не найден' });
    }

    if (!canManageLessonAttendance(req.user, lesson)) {
        return res.status(403).json({ message: 'Access denied' });
    }

    const allStudentIdsInGroup = lesson.group.students;
    const lessonDate = lesson.dueDate || new Date();

    const bulkOps = allStudentIdsInGroup.map(studentId => {
        const isPresent = presentStudentIds.includes(studentId.toString());
        return {
            updateOne: {
                filter: { lesson: lessonId, student: studentId },
                update: {
                    $set: {
                        status: isPresent ? 'present' : 'absent',
                        date: lessonDate,
                        teacher: teacherId
                    }
                },
                upsert: true // Создаст запись, если ее нет
            }
        };
    });

    if (bulkOps.length > 0) {
        await Attendance.bulkWrite(bulkOps);
    }

    res.status(200).json({ message: 'Посещаемость успешно обновлена' });
}));

module.exports = router;
