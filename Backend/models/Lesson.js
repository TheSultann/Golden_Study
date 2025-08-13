const mongoose = require('mongoose');

const AssignmentSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
});

const LessonSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    assignments: [AssignmentSchema],
    description: {
        type: String
    },
    dueDate: {
        type: Date,
    },
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true // <-- ДОБАВЛЕНО
    },
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: true,
        index: true // <-- ДОБАВЛЕНО
    }
}, { timestamps: true });

module.exports = mongoose.model('Lesson', LessonSchema);