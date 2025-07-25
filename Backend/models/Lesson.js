const mongoose = require('mongoose');

// --- СНОВА СОЗДАЕМ ОТДЕЛЬНУЮ СХЕМУ ДЛЯ ЗАДАНИЙ ---
const AssignmentSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
});


const LessonSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    // --- ВОЗВРАЩАЕМ МАССИВ ЗАДАНИЙ ОБРАТНО ---
    assignments: [AssignmentSchema], // Теперь урок снова может иметь задания
    
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
    },
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Lesson', LessonSchema);