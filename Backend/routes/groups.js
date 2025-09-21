const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const User = require('../models/User');
const auth = require('../middleware/auth.middleware');
const { cache, clearUserCacheById, clearOverviewCache } = require('../middleware/cache.middleware');
const taskQueue = require('../queues/taskQueue');
const asyncHandler = require('../utils/asyncHandler'); // --- 1. ИМПОРТИРУЕМ ОБЕРТКУ ---

// --- 2. ОБОРАЧИВАЕМ РОУТЫ В asyncHandler И УБИРАЕМ try...catch ---

router.get('/all', [auth, auth.adminOnly], asyncHandler(async (req, res) => {
    const groups = await Group.find({ status: 'active' }).select('name').sort({ name: 1 }).lean();
    res.json(groups);
}));

router.get('/', [auth, auth.teacherOrAdmin, cache(3600)], asyncHandler(async (req, res) => {
    const findQuery = {
        teacher: req.user.userId,
        status: { $ne: 'pending_deletion' }
    };
    const groups = await Group.find(findQuery)
        .populate('students', 'name email')
        .lean();
    res.json(groups);
}));

router.get('/unassigned', [auth, auth.teacherOrAdmin, cache(3600)], asyncHandler(async (req, res) => {
    const unassignedStudents = await User.aggregate([
        { $match: { role: 'student' } },
        { $lookup: { from: 'groups', localField: 'group', foreignField: '_id', as: 'groupData' } },
        { $match: { groupData: { $eq: [] } } },
        { $project: { groupData: 0, password: 0 } }
    ]);
    res.json(unassignedStudents);
}));

router.post('/', [auth, auth.teacherOrAdmin], asyncHandler(async (req, res) => {
    const { name, description } = req.body;
    const existingGroup = await Group.findOne({ name, teacher: req.user.userId, status: 'active' }).lean();
    if (existingGroup) {
        return res.status(400).json({ message: `Группа с названием "${name}" уже существует.` });
    }
    const newGroup = new Group({ name, teacher: req.user.userId, ...(description && { description }) });
    await newGroup.save();
    await clearUserCacheById(req.user.userId);
    await clearOverviewCache();
    res.status(201).json(newGroup);
}));

router.put('/:groupId/assign', [auth, auth.teacherOrAdmin], asyncHandler(async (req, res) => {
    const { studentId } = req.body;
    const { userId, role } = req.user;
    const query = (role === 'admin') ? { _id: req.params.groupId } : { _id: req.params.groupId, teacher: userId };
    const group = await Group.findOneAndUpdate(query, { $addToSet: { students: studentId } }, { new: true }).lean();
    if (!group) return res.status(404).json({ message: 'Группа не найдена или доступ запрещен' });
    
    const updated = await User.updateOne({ _id: studentId, group: null }, { $set: { group: req.params.groupId } });
    if (updated.matchedCount === 0) {
        return res.status(400).json({ message: 'Этот ученик уже состоит в другой группе' });
    }
    
    await clearUserCacheById(req.user.userId);
    await clearOverviewCache();
    res.json({ message: 'Ученик успешно добавлен в группу' });
}));

router.delete('/:groupId/students/:studentId', [auth, auth.teacherOrAdmin], asyncHandler(async (req, res) => {
    const { groupId, studentId } = req.params;
    const { userId, role } = req.user;
    const query = (role === 'admin') ? { _id: groupId } : { _id: groupId, teacher: userId };
    const group = await Group.findOneAndUpdate(query, { $pull: { students: studentId } }, { new: true }).lean();
    if (!group) {
        return res.status(404).json({ message: 'Группа не найдена или доступ запрещен' });
    }
    
    await User.updateOne({ _id: studentId }, { $set: { group: null } });
    await clearUserCacheById(req.user.userId);
    await clearOverviewCache();
    res.json({ message: 'Ученик успешно удален из группы' });
}));

router.delete('/:groupId', [auth, auth.teacherOrAdmin], asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const { userId, role } = req.user;
    const query = (role === 'admin') ? { _id: groupId } : { _id: groupId, teacher: userId };
    const groupToUpdate = await Group.findOneAndUpdate(query, { $set: { status: 'pending_deletion' } });
    if (!groupToUpdate) {
        return res.status(404).json({ message: 'Группа не найдена или у вас нет прав на её удаление' });
    }
    
    if (groupToUpdate.students && groupToUpdate.students.length > 0) {
        await User.updateMany(
            { _id: { $in: groupToUpdate.students } },
            { $set: { group: null } }
        );
    }
    
    taskQueue.add('delete-group', { groupId });
    await clearUserCacheById(userId);
    await clearOverviewCache();
    res.json({ message: 'Группа успешно удалена.' });
}));

module.exports = router;