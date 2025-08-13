const mongoose = require('mongoose');

// --- СХЕМА ДЛЯ ОЦЕНКИ КОНКРЕТНОГО НАВЫКА/ЗАДАНИЯ ---
const SkillEvaluationSchema = new mongoose.Schema({
    assignmentId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    assignmentTitle: {
        type: String,
        required: true
    },
    completed: {
        type: Boolean,
        default: false
    }
}, { _id: false });


const EvaluationSchema = new mongoose.Schema({
    lesson: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lesson',
        required: true,
        index: true // <-- ДОБАВЛЕНО
    },
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true // <-- ДОБАВЛЕНО
    },
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true // <-- ДОБАВЛЕНО
    },
    grade: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    skills: [SkillEvaluationSchema], 
}, { 
    timestamps: true 
});

// Этот индекс уже был и он очень хорош. Оставляем его.
EvaluationSchema.index({ lesson: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('Evaluation', EvaluationSchema);