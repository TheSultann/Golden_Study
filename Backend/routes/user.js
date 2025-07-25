const { Router } = require('express');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth.Middleware');
const router = Router();

// PUT /api/user/profile - Обновление профиля пользователя (имени)
router.put('/profile', authMiddleware, async (req, res) => {
    try {
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
        
        // Возвращаем обновленное имя, чтобы фронтенд мог обновить localStorage
        res.json({ message: 'Профиль успешно обновлен', user: { name: user.name } });

    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Что-то пошло не так, попробуйте снова' });
    }
});

module.exports = router;