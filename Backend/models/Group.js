// Backend/models/Group.js

const mongoose = require('mongoose');

const GroupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
    },
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    students: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    // ДОБАВЛЕНО: Поле для "мягкого" удаления
    status: {
        type: String,
        enum: ['active', 'pending_deletion'],
        default: 'active'
    }
}, { timestamps: true });

// ДОБАВЛЕНО: Индекс для ускорения выборок
GroupSchema.index({ teacher: 1, status: 1 });

module.exports = mongoose.model('Group', GroupSchema);