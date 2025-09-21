const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    password: {
        type: String,
        required: true,
        select: false
    },
    role: {
        type: String,
        // --- ИЗМЕНЕНИЕ: Добавлена роль 'admin' ---
        enum: ['student', 'teacher', 'admin'],
        default: 'student',
        required: true,
        index: true
    },
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        default: null,
        index: true
    }
});

module.exports = mongoose.model('User', UserSchema);