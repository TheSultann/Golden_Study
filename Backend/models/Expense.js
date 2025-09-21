const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema({
    description: {
        type: String,
        required: true,
        trim: true
    },
    amount: {
        type: Number,
        required: true
    },
    category: {
        type: String,
        required: true,
        enum: ['rent', 'utilities', 'supplies', 'marketing', 'other'],
        default: 'other'
    },
    expenseDate: {
        type: Date,
        required: true,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('Expense', ExpenseSchema);