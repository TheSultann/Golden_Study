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
        required: true
    },
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
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

// Индекс для быстрого поиска оценки конкретного ученика по уроку
EvaluationSchema.index({ lesson: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('Evaluation', EvaluationSchema);