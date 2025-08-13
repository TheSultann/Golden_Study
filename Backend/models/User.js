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
        index: true // <-- ДОБАВЛЕНО
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        required: true,
        default: 'student',
        index: true // <-- ДОБАВЛЕНО
    },
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        default: null,
        index: true // <-- ДОБАВЛЕНО
    }
});

module.exports = mongoose.model('User', UserSchema);