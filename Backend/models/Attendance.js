const { Schema, model, Types } = require('mongoose');

const AttendanceSchema = new Schema({
    student: {
        type: Types.ObjectId,
        ref: 'User',
        required: true,
    },
    lesson: {
        type: Types.ObjectId,
        ref: 'Lesson',
        required: true,
    },
    status: {
        type: String,
        enum: ['present', 'absent', 'excused'], // Присутствовал, отсутствовал, по ув. причине
        required: true,
    },
    date: {
        type: Date,
        required: true,
    },
    teacher: { // Учитель, отметивший посещаемость
        type: Types.ObjectId,
        ref: 'User',
        required: true,
    }
}, { timestamps: true });

// Индекс для предотвращения дубликатов (один студент - один урок)
AttendanceSchema.index({ student: 1, lesson: 1 }, { unique: true });

module.exports = model('Attendance', AttendanceSchema);