import React, { useState, useEffect, useCallback } from 'react';
import styles from './AccountingPage.module.css';
import API from '../api';
import { FiTrash2, FiEdit3, FiTrendingUp, FiTrendingDown, FiDollarSign } from 'react-icons/fi';
// --- 1. ИМПОРТИРУЕМ Bar ИЗ БИБЛИОТЕКИ ---
import { Doughnut, Bar } from 'react-chartjs-2';
// --- 2. РЕГИСТРИРУЕМ НОВЫЙ ЭЛЕМЕНТ ДЛЯ СТОЛБЦОВ ---
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, Filler } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

// --- 3. РЕГИСТРИРУЕМ ВСЕ КОМПОНЕНТЫ, ВКЛЮЧАЯ BarElement ---
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, Filler, ChartDataLabels);

const getCurrentMonth = () => new Date().toISOString().slice(0, 7);

const KpiCard = ({ icon, label, value, color }) => (
    <div className={styles.kpiCard} style={{ borderLeftColor: color }}>
        <div className={styles.kpiIcon}>{icon}</div>
        <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{value.toLocaleString('uz-UZ')} UZS</span>
            <span className={styles.kpiLabel}>{label}</span>
        </div>
    </div>
);

const ExpensePieChart = ({ data }) => {
    const chartData = {
        labels: data.map(d => d.category),
        datasets: [{
            data: data.map(d => d.amount),
            backgroundColor: ['#4a90e2', '#50e3c2', '#f5a623', '#bd10e0', '#7ed321', '#9013fe'],
            borderColor: '#ffffff',
            borderWidth: 2,
        }],
    };
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top' },
            datalabels: {
                formatter: (value, context) => {
                    const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                    const percentage = (value / total * 100);
                    return percentage > 5 ? percentage.toFixed(1) + '%' : '';
                },
                color: '#fff',
                font: { weight: 'bold', size: 14 },
            },
        },
    };
    return <Doughnut data={chartData} options={options} />;
};

// --- 4. ИЗМЕНЯЕМ КОМПОНЕНТ ГРАФИКА ТРЕНДОВ ---
const FinancialTrendChart = ({ data }) => {
    const chartData = {
        labels: data.map(d => new Date(d.period).toLocaleString('default', { month: 'short', year: '2-digit' })),
        datasets: [
            {
                label: 'Income',
                data: data.map(d => d.income),
                backgroundColor: 'rgba(56, 161, 105, 0.7)', // Более насыщенный цвет для столбцов
                borderColor: 'rgba(56, 161, 105, 1)',
                borderWidth: 1,
            },
            {
                label: 'Expenses',
                data: data.map(d => d.expenses),
                backgroundColor: 'rgba(197, 48, 48, 0.7)', // Более насыщенный цвет для столбцов
                borderColor: 'rgba(197, 48, 48, 1)',
                borderWidth: 1,
            },
        ],
    };
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: { beginAtZero: true },
            x: { grid: { display: false } } // Убираем вертикальные линии для чистоты
        },
        plugins: {
            legend: { position: 'top' }
        }
    };
    // --- 5. ЗАМЕНЯЕМ Line НА Bar ---
    return <Bar data={chartData} options={options} />;
};


const AccountingPage = () => {
    const [activeTab, setActiveTab] = useState('summary');
    const [salaries, setSalaries] = useState([]);
    const [salaryPeriod, setSalaryPeriod] = useState(getCurrentMonth());
    const [isLoadingSalaries, setIsLoadingSalaries] = useState(false);
    const [editingSalary, setEditingSalary] = useState(null);
    const [expenses, setExpenses] = useState([]);
    const [isLoadingExpenses, setIsLoadingExpenses] = useState(false);
    const [newExpense, setNewExpense] = useState({ description: '', amount: '', category: 'other', expenseDate: new Date().toISOString().slice(0, 10) });
    const [isAddingExpense, setIsAddingExpense] = useState(false);
    
    const [summaryData, setSummaryData] = useState(null);
    const [trendData, setTrendData] = useState(null);
    const [summaryPeriod, setSummaryPeriod] = useState(getCurrentMonth());
    const [isLoadingSummary, setIsLoadingSummary] = useState(false);

    const [error, setError] = useState('');

    const fetchSummaryData = useCallback(async () => {
        setIsLoadingSummary(true);
        setError('');
        try {
            const [summaryRes, trendsRes] = await Promise.all([
                API.get(`/api/accounting/summary?period=${summaryPeriod}`),
                API.get('/api/accounting/trends')
            ]);
            setSummaryData(summaryRes.data);
            setTrendData(trendsRes.data);
        } catch (err) {
            setError('Failed to fetch financial data.');
        } finally {
            setIsLoadingSummary(false);
        }
    }, [summaryPeriod]);

    useEffect(() => {
        if (activeTab === 'summary') fetchSummaryData();
    }, [activeTab, fetchSummaryData]);

    const fetchSalaries = useCallback(async () => {
        setIsLoadingSalaries(true);
        setError('');
        try {
            const res = await API.get(`/api/accounting/salaries?period=${salaryPeriod}`);
            setSalaries(res.data);
        } catch (err) { setError('Failed to fetch salaries.'); } 
        finally { setIsLoadingSalaries(false); }
    }, [salaryPeriod]);

    useEffect(() => { if (activeTab === 'salaries') fetchSalaries(); }, [activeTab, fetchSalaries]);

    const handleSaveSalary = async (teacherId, amount) => {
        if (!amount || amount <= 0) return setError('Please enter a valid amount.');
        try {
            await API.post('/api/accounting/salaries', { teacherId, period: salaryPeriod, amount });
            setEditingSalary(null);
            fetchSalaries();
        } catch (err) { setError('Failed to save salary.'); }
    };

    const handleMarkSalaryPaid = async (salaryId) => {
        if (!salaryId) return setError('Cannot pay salary. Please set an amount and save first.');
        try {
            await API.patch(`/api/accounting/salaries/${salaryId}/pay`);
            fetchSalaries();
        } catch (err) { setError(err.response?.data?.message || 'Failed to mark as paid.'); }
    };

    const fetchExpenses = useCallback(async () => {
        setIsLoadingExpenses(true);
        setError('');
        try {
            const res = await API.get('/api/accounting/expenses');
            setExpenses(res.data);
        } catch (err) { setError('Failed to fetch expenses.'); } 
        finally { setIsLoadingExpenses(false); }
    }, []);

    useEffect(() => { if (activeTab === 'expenses') fetchExpenses(); }, [activeTab, fetchExpenses]);

    const handleAddExpense = async (e) => {
        e.preventDefault();
        setIsAddingExpense(true);
        setError('');
        try {
            await API.post('/api/accounting/expenses', newExpense);
            setNewExpense({ description: '', amount: '', category: 'other', expenseDate: new Date().toISOString().slice(0, 10) });
            fetchExpenses();
        } catch (err) { setError('Failed to add expense.'); } 
        finally { setIsAddingExpense(false); }
    };

    const handleDeleteExpense = async (expenseId) => {
        if (window.confirm('Are you sure?')) {
            try {
                await API.delete(`/api/accounting/expenses/${expenseId}`);
                fetchExpenses();
            } catch (err) { setError('Failed to delete expense.'); }
        }
    };

    const renderSummaryTab = () => (
        <div>
            <div className={styles.filters}>
                <div className={styles.formGroup}>
                    <label>Month</label>
                    <input type="month" value={summaryPeriod} onChange={e => setSummaryPeriod(e.target.value)} className={styles.input} />
                </div>
            </div>
            {isLoadingSummary ? <p>Loading dashboard...</p> : summaryData && trendData && (
                <div className={styles.summaryGrid}>
                    <div className={styles.kpiGrid}>
                        <KpiCard icon={<FiTrendingUp />} label="Total Income" value={summaryData.totalIncome} color="#38a169" />
                        <KpiCard icon={<FiTrendingDown />} label="Total Expenses" value={summaryData.totalExpenses} color="#c53030" />
                        <KpiCard icon={<FiDollarSign />} label="Net Profit" value={summaryData.netProfit} color={summaryData.netProfit >= 0 ? '#4a90e2' : '#c53030'} />
                    </div>
                    
                    <div className={styles.chartCard}>
                        <h3>Financial Trends (Last 6 Months)</h3>
                        <div className={styles.chartContainer}>
                            <FinancialTrendChart data={trendData} />
                        </div>
                    </div>

                    <div className={styles.chartsGrid}>
                        <div className={styles.chartCard}>
                            <h3>Expense Breakdown</h3>
                            <div className={styles.chartContainer}>
                                {summaryData.expenseBreakdown.length > 0 ? (
                                    <ExpensePieChart data={summaryData.expenseBreakdown} />
                                ) : <p>No expenses to display.</p>}
                            </div>
                        </div>
                        <div className={styles.card}>
                            <h3>Expense Details</h3>
                            {summaryData.expenseBreakdown.length > 0 ? (
                                <ul className={styles.breakdownList}>
                                    {summaryData.expenseBreakdown.map(item => {
                                        const percentage = summaryData.totalExpenses > 0 
                                            ? ((item.amount / summaryData.totalExpenses) * 100).toFixed(1)
                                            : 0;
                                        return (
                                            <li key={item.category}>
                                                <span className={styles.categoryLabel}>{item.category}</span>
                                                <div className={styles.amountContainer}>
                                                    <span className={styles.amountLabel}>{item.amount.toLocaleString('uz-UZ')} UZS</span>
                                                    <span className={styles.breakdownPercentage}>({percentage}%)</span>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : <p>No expenses recorded for this period.</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const renderSalariesTab = () => (
        <div>
            <div className={styles.filters}>
                <div className={styles.formGroup}>
                    <label>Month</label>
                    <input type="month" value={salaryPeriod} onChange={e => setSalaryPeriod(e.target.value)} className={styles.input} />
                </div>
            </div>
            <div className={styles.tableContainer}>
                <table className={styles.table}>
                    <thead><tr><th>Teacher</th><th>Amount (UZS)</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody>
                        {isLoadingSalaries ? (<tr><td colSpan="4">Loading...</td></tr>) : (
                            salaries.map(s => (
                                <tr key={s.teacher._id}>
                                    <td data-label="Teacher">{s.teacher.name}</td>
                                    <td data-label="Amount">
                                        {editingSalary?.teacherId === s.teacher._id ? (
                                            <input type="number" className={styles.input} value={editingSalary.amount} onChange={e => setEditingSalary({ ...editingSalary, amount: e.target.value })} autoFocus />
                                        ) : (s.amount.toLocaleString('uz-UZ'))}
                                    </td>
                                    <td data-label="Status"><span className={`${styles.status} ${s.status === 'paid' ? styles.paid : styles.pending}`}>{s.status}</span></td>
                                    <td data-label="Action" className={styles.actions}>
                                        {editingSalary?.teacherId === s.teacher._id ? (
                                            <><button onClick={() => handleSaveSalary(s.teacher._id, editingSalary.amount)} className={styles.saveButton}>Save</button><button onClick={() => setEditingSalary(null)} className={styles.cancelButton}>Cancel</button></>
                                        ) : (
                                            <><button onClick={() => setEditingSalary({ id: s._id, teacherId: s.teacher._id, amount: s.amount })} className={styles.editButton} disabled={s.status === 'paid'}><FiEdit3 /></button><button onClick={() => handleMarkSalaryPaid(s._id)} className={styles.payButton} disabled={s.status === 'paid' || s.amount <= 0}>Pay</button></>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderExpensesTab = () => (
        <div className={styles.expensesGrid}>
            <div className={styles.card}>
                <h3>Add New Expense</h3>
                <form onSubmit={handleAddExpense}>
                    <div className={styles.formGroup}><label>Description</label><input type="text" value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} className={styles.input} required /></div>
                    <div className={styles.formGroup}><label>Amount (UZS)</label><input type="number" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} className={styles.input} required /></div>
                    <div className={styles.formGroup}><label>Category</label><select value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value})} className={styles.input} required><option value="rent">Rent</option><option value="utilities">Utilities</option><option value="supplies">Supplies</option><option value="marketing">Marketing</option><option value="other">Other</option></select></div>
                    <div className={styles.formGroup}><label>Date</label><input type="date" value={newExpense.expenseDate} onChange={e => setNewExpense({...newExpense, expenseDate: e.target.value})} className={styles.input} required /></div>
                    <button type="submit" className={styles.button} disabled={isAddingExpense}>{isAddingExpense ? 'Adding...' : 'Add Expense'}</button>
                </form>
            </div>
            <div className={`${styles.card} ${styles.expenseList}`}>
                 <h3>Recent Expenses</h3>
                 <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th></th></tr></thead>
                        <tbody>
                            {isLoadingExpenses ? (<tr><td colSpan="5">Loading...</td></tr>) : (
                                expenses.map(exp => (
                                    <tr key={exp._id}>
                                        <td data-label="Date">{new Date(exp.expenseDate).toLocaleDateString()}</td><td data-label="Description">{exp.description}</td><td data-label="Category">{exp.category}</td><td data-label="Amount">{exp.amount.toLocaleString('uz-UZ')} UZS</td>
                                        <td data-label="Action"><button onClick={() => handleDeleteExpense(exp._id)} className={styles.deleteButton}><FiTrash2 /></button></td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                 </div>
            </div>
        </div>
    );

    return (
        <div className={styles.wrapper}>
            <header className={styles.header}><h1>Accounting</h1><p>Manage teacher salaries and company expenses.</p></header>
            <div className={styles.tabs}>
                <button onClick={() => setActiveTab('summary')} className={activeTab === 'summary' ? styles.activeTab : ''}>Summary</button>
                <button onClick={() => setActiveTab('salaries')} className={activeTab === 'salaries' ? styles.activeTab : ''}>Salaries</button>
                <button onClick={() => setActiveTab('expenses')} className={activeTab === 'expenses' ? styles.activeTab : ''}>Expenses</button>
            </div>
            {error && <div className={styles.error}>{error}</div>}
            <div className={styles.content}>
                {activeTab === 'summary' && renderSummaryTab()}
                {activeTab === 'salaries' && renderSalariesTab()}
                {activeTab === 'expenses' && renderExpensesTab()}
            </div>
        </div>
    );
};

export default AccountingPage;