const mongoose = require('mongoose');

const SalarySchema = new mongoose.Schema({
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Период в формате 'YYYY-MM'
    period: {
        type: String,
        required: true,
        index: true
    },
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'paid'],
        default: 'pending'
    },
    paymentDate: {
        type: Date
    }
}, { timestamps: true });

// Уникальный индекс, чтобы у одного учителя не было двух записей о зарплате за один и тот же месяц
SalarySchema.index({ teacher: 1, period: 1 }, { unique: true });

module.exports = mongoose.model('Salary', SalarySchema);