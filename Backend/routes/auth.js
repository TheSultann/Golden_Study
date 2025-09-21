// Backend/routes/auth.js

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler'); // --- 1. ИМПОРТИРУЕМ ОБЕРТКУ ---

// --- 2. ОБОРАЧИВАЕМ РОУТЫ В asyncHandler И УБИРАЕМ try...catch ---

router.post('/register', asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    const candidate = await User.findOne({ email });
    if (candidate) {
        // Для ошибок валидации лучше оставлять явный return
        return res.status(400).json({ message: 'Такой пользователь уже существует' });
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = new User({ name, email, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: 'Пользователь создан' });
}));

router.post('/login', asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
        return res.status(400).json({ message: 'Пользователь не найден' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return res.status(400).json({ message: 'Неверный пароль' });
    }

    const token = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
    );
    
    res.json({ token, userId: user.id, role: user.role, name: user.name });
}));

module.exports = router;