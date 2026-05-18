const { Router } = require('express');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth.middleware');
const router = Router();
const { cache, clearCacheByPattern } = require('../middleware/cache.middleware');
const asyncHandler = require('../utils/asyncHandler'); // --- 1. ИМПОРТИРУЕМ ОБЕРТКУ ---

// --- 2. ОБОРАЧИВАЕМ РОУТ В asyncHandler И УБИРАЕМ try...catch ---
router.get('/roles', [authMiddleware, authMiddleware.adminOnly, cache(300)], asyncHandler(async (req, res) => {
    const users = await User.find({})
        .select('_id name email role')
        .sort({ name: 1, email: 1 })
        .lean();

    res.json({ users, currentUserId: req.user.userId });
}));

router.patch('/roles/:userId', [authMiddleware, authMiddleware.adminOnly], asyncHandler(async (req, res) => {
    const { role } = req.body;
    const allowedRoles = ['student', 'teacher', 'admin'];

    if (!allowedRoles.includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
    }

    if (req.params.userId === req.user.userId && role !== 'admin') {
        return res.status(400).json({ message: 'You cannot remove your own admin role' });
    }

    const user = await User.findById(req.params.userId).select('_id name email role');

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    user.role = role;
    await user.save();
    await clearCacheByPattern('cache:*:GET:/api/user/roles*');

    res.json({
        message: 'Role updated successfully',
        user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
        },
    });
}));

router.put('/profile', authMiddleware, asyncHandler(async (req, res) => {
    const { name } = req.body;
    const userId = req.user.userId;

    if (!name) {
        return res.status(400).json({ message: 'Имя не может быть пустым' });
    }

    const user = await User.findById(userId);

    if (!user) {
        return res.status(404).json({ message: 'Пользователь не найден' });
    }

    user.name = name;
    await user.save();
    
    res.json({ message: 'Profile updated successfully', user: { name: user.name } });
}));

module.exports = router;
