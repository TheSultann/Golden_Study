const { Router } = require('express');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth.middleware');
const router = Router();
const asyncHandler = require('../utils/asyncHandler'); // --- 1. ИМПОРТИРУЕМ ОБЕРТКУ ---

// --- 2. ОБОРАЧИВАЕМ РОУТ В asyncHandler И УБИРАЕМ try...catch ---
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