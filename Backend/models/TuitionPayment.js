const mongoose = require('mongoose');

const TuitionPaymentSchema = new mongoose.Schema({
    student: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    group: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Group', 
        required: true 
    },
    // Период оплаты в формате 'YYYY-MM', например '2025-10'
    billingPeriod: { 
        type: String, 
        required: true,
        index: true 
    },
    amountDue: { 
        type: Number, 
        required: true 
    },
    amountPaid: { 
        type: Number, 
        default: 0 
    },
    paymentDate: { 
        type: Date 
    },
    status: {
        type: String,
        enum: ['unpaid', 'paid', 'overdue'],
        default: 'unpaid'
    }
}, { timestamps: true });

// Создаем составной индекс, чтобы не было дубликатов счетов для одного студента за один период
TuitionPaymentSchema.index({ student: 1, billingPeriod: 1 }, { unique: true });

module.exports = mongoose.model('TuitionPayment', TuitionPaymentSchema);