// Backend/routes/auth.js

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const candidate = await User.findOne({ email });
        if (candidate) {
            return res.status(400).json({ message: 'Такой пользователь уже существует' });
        }
        const hashedPassword = await bcrypt.hash(password, 12);
        const user = new User({ name, email, password: hashedPassword });
        await user.save();
        res.status(201).json({ message: 'Пользователь создан' });
    } catch (e) {
        res.status(500).json({ message: 'Что-то пошло не так' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Пользователь не найден' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Неверный пароль' });
        }

        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET, // <-- ИЗМЕНЕНО: Секрет берется из переменных окружения
            { expiresIn: '1h' }
        );
        
        res.json({ token, userId: user.id, role: user.role, name: user.name });

    } catch (e) {
        res.status(500).json({ message: 'Что-то пошло не так' });
    }
});

module.exports = router;