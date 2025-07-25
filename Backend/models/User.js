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
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        required: true,
        default: 'student'
    },
    // --- ДОБАВЛЯЕМ ЭТО ПОЛЕ ---
    // Ссылка на группу, в которой состоит ученик.
    // Не обязательна, так как при регистрации ученик не в группе.
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        default: null
    }
});

module.exports = mongoose.model('User', UserSchema);