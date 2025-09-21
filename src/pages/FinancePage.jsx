// src/pages/FinancePage.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styles from './FinancePage.module.css';
import API from '../api';
import Modal from '../components/Modal/Modal';
import { FiPlusCircle, FiTrendingUp, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';

// Хелпер для получения текущего месяца в формате YYYY-MM
const getCurrentMonth = () => new Date().toISOString().slice(0, 7);

// Компонент для карточки со статистикой (без изменений)
const StatCard = ({ icon, label, value, color }) => (
    <div className={styles.statCard}>
        <div className={styles.statIcon} style={{ backgroundColor: color }}>{icon}</div>
        <div className={styles.statContent}>
            <span className={styles.statValue}>{value}</span>
            <span className={styles.statLabel}>{label}</span>
        </div>
    </div>
);

// Компонент для статуса (без изменений)
const StatusIndicator = ({ status }) => {
    const config = {
        paid: { text: 'Paid', className: styles.statusPaid },
        unpaid: { text: 'Unpaid', className: styles.statusUnpaid },
        overdue: { text: 'Overdue', className: styles.statusOverdue }
    }[status] || { text: status };
    return <span className={`${styles.status} ${config.className}`}>{config.text}</span>;
};

const FinancePage = () => {
    // Состояния для фильтров (без изменений)
    const [periodStart, setPeriodStart] = useState(getCurrentMonth());
    const [periodEnd, setPeriodEnd] = useState(getCurrentMonth());
    const [selectedGroup, setSelectedGroup] = useState('all');

    // Состояния для данных и UI (без изменений)
    const [payments, setPayments] = useState([]);
    const [groupsForFilter, setGroupsForFilter] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [updatingPaymentId, setUpdatingPaymentId] = useState(null);

    // Состояния для модального окна (обновлены)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalBillingPeriod, setModalBillingPeriod] = useState(getCurrentMonth());
    const [groupAmounts, setGroupAmounts] = useState({});
    const [modalMessage, setModalMessage] = useState('');
    const [modalError, setModalError] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Загрузка данных для таблицы (без изменений)
    const fetchPayments = useCallback(async () => {
        if (!periodStart || !periodEnd) return;
        setIsLoading(true);
        setError('');
        try {
            const url = `/api/finance?periodStart=${periodStart}&periodEnd=${periodEnd}&groupId=${selectedGroup}`;
            const response = await API.get(url);
            setPayments(response.data);
        } catch (err) {
            setError('Failed to load invoices.');
        } finally {
            setIsLoading(false);
        }
    }, [periodStart, periodEnd, selectedGroup]);

    useEffect(() => {
        fetchPayments();
    }, [fetchPayments]);

    // Загрузка списка групп для фильтра и модального окна (без изменений)
    useEffect(() => {
        const fetchGroups = async () => {
            try {
                const response = await API.get('/api/groups/all');
                setGroupsForFilter(response.data);
            } catch (err) { console.error("Failed to load groups:", err); }
        };
        fetchGroups();
    }, []);

    // --- НОВОЕ: Загрузка последних сумм при открытии модального окна ---
    useEffect(() => {
        const fetchLastAmounts = async () => {
            try {
                const response = await API.get('/api/finance/last-amounts');
                setGroupAmounts(response.data); // Автозаполнение сумм
            } catch (error) {
                console.error("Не удалось загрузить последние суммы:", error);
            }
        };

        if (isModalOpen) {
            fetchLastAmounts();
        }
    }, [isModalOpen]);

    // Вычисление статистики (без изменений)
    const stats = useMemo(() => {
        return payments.reduce((acc, payment) => {
            acc.totalDue += payment.amountDue;
            if (payment.status === 'paid') {
                acc.totalPaid += payment.amountPaid;
            } else {
                acc.unpaidCount += 1;
            }
            return acc;
        }, { totalDue: 0, totalPaid: 0, unpaidCount: 0 });
    }, [payments]);

    // Обработчик "Mark as Paid" (без изменений)
    const handleMarkAsPaid = async (paymentId) => {
        setUpdatingPaymentId(paymentId);
        try {
            const response = await API.patch(`/api/finance/${paymentId}/pay`);
            setPayments(payments.map(p => p._id === paymentId ? response.data : p));
        } catch (err) {
            setError('Failed to update status.');
        } finally {
            setUpdatingPaymentId(null);
        }
    };

    // Обработчик генерации счетов (обновлен)
    const handleGenerateInvoices = async (e) => {
        e.preventDefault();
        setIsGenerating(true);
        setModalMessage('');
        setModalError('');

        const finalGroupAmounts = Object.fromEntries(
            Object.entries(groupAmounts).filter(([_, amount]) => amount && Number(amount) > 0)
        );

        if (Object.keys(finalGroupAmounts).length === 0) {
            setModalError('Пожалуйста, укажите сумму хотя бы для одной группы.');
            setIsGenerating(false);
            return;
        }

        try {
            const response = await API.post('/api/finance/generate', {
                billingPeriod: modalBillingPeriod,
                groupAmounts: finalGroupAmounts
            });
            setModalMessage(`Успешно! Создано новых счетов: ${response.data.createdCount}.`);
            await fetchPayments();
            setTimeout(() => {
                setIsModalOpen(false);
                setModalMessage('');
                setGroupAmounts({});
            }, 2000);
        } catch (err) {
            setModalError(err.response?.data?.message || 'Произошла ошибка.');
        } finally {
            setIsGenerating(false);
        }
    };
    
    // Хелпер для обновления сумм в модалке (без изменений)
    const handleAmountChange = (groupId, value) => {
        setGroupAmounts(prev => ({
            ...prev,
            [groupId]: value
        }));
    };

    const formatCurrency = (amount) => `${Number(amount).toLocaleString('uz-UZ')} UZS`;

    return (
        <div className={styles.dashboardWrapper}>
            <header className={styles.header}>
                <h1>Finance Dashboard</h1>
                <p>Overview of financial activity and invoice management.</p>
            </header>

            <div className={styles.statsGrid}>
                <StatCard icon={<FiTrendingUp />} label="Total Amount Due" value={formatCurrency(stats.totalDue)} color="#4a90e2" />
                <StatCard icon={<FiCheckCircle />} label="Total Paid" value={formatCurrency(stats.totalPaid)} color="#38a169" />
                <StatCard icon={<FiAlertCircle />} label="Unpaid Invoices" value={stats.unpaidCount} color="#dd6b20" />
            </div>

            <div className={styles.card}>
                <div className={styles.filtersBar}>
                    <div className={styles.filterGroup}>
                        <div className={styles.formGroup}>
                            <label htmlFor="periodStart">From</label>
                            <input type="month" id="periodStart" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className={styles.input} />
                        </div>
                        <div className={styles.formGroup}>
                            <label htmlFor="periodEnd">To</label>
                            <input type="month" id="periodEnd" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className={styles.input} />
                        </div>
                        <div className={styles.formGroup}>
                            <label htmlFor="groupFilter">Group</label>
                            <select id="groupFilter" value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)} className={styles.input}>
                                <option value="all">All Groups</option>
                                {groupsForFilter.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <button className={styles.actionButton} onClick={() => setIsModalOpen(true)}>
                        <FiPlusCircle /> Generate Invoices
                    </button>
                </div>

                <div className={styles.tableContainer}>
                    <table className={styles.paymentsTable}>
                        <thead>
                            <tr>
                                <th>Student</th>
                                <th>Group</th>
                                <th>Billing Period</th>
                                <th>Amount Due</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan="6" className={styles.centered}>Loading...</td></tr>
                            ) : payments.length > 0 ? (
                                payments.map(p => (
                                    <tr key={p._id}>
                                        <td>{p.student?.name || 'N/A'}</td>
                                        <td>{p.group?.name || 'N/A'}</td>
                                        <td>{p.billingPeriod}</td>
                                        <td>{formatCurrency(p.amountDue)}</td>
                                        <td><StatusIndicator status={p.status} /></td>
                                        <td>
                                            {p.status === 'unpaid' ? (
                                                <button onClick={() => handleMarkAsPaid(p._id)} className={styles.payButton} disabled={updatingPaymentId === p._id}>
                                                    {updatingPaymentId === p._id ? '...' : 'Mark Paid'}
                                                </button>
                                            ) : (
                                                <span className={styles.paymentDate}>{new Date(p.paymentDate).toLocaleDateString('en-GB')}</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="6" className={styles.centered}>No invoices found for the selected period.</td></tr>
                            )}
                        </tbody>
                    </table>
                    {error && <div className={styles.errorMessage}>{error}</div>}
                </div>
            </div>

            {/* --- МОДАЛЬНОЕ ОКНО С НОВЫМ СТИЛЕМ И АВТОЗАПОЛНЕНИЕМ --- */}
            <Modal isOpen={isModalOpen} onRequestClose={() => setIsModalOpen(false)} title="Generate Monthly Invoices">
                <form onSubmit={handleGenerateInvoices} className={styles.modalForm}>
                    <p>Укажите месяц и сумму для каждой группы. Суммы автоматически подставлены из последних счетов.</p>
                    
                    <div className={styles.formGroup}>
                        <label htmlFor="modalBillingPeriod">Месяц выставления</label>
                        <input type="month" id="modalBillingPeriod" value={modalBillingPeriod} onChange={e => setModalBillingPeriod(e.target.value)} className={styles.input} required />
                    </div>

                    <div className={styles.groupAmountsGrid}>
                        {groupsForFilter.length > 0 ? groupsForFilter.map(group => (
                            <div key={group._id} className={styles.groupAmountItem}>
                                <label htmlFor={`group-amount-${group._id}`}>{group.name}</label>
                                <input
                                    type="number"
                                    id={`group-amount-${group._id}`}
                                    placeholder="0 UZS"
                                    className={styles.input}
                                    min="1"
                                    value={groupAmounts[group._id] || ''}
                                    onChange={e => handleAmountChange(group._id, e.target.value)}
                                />
                            </div>
                        )) : <p>Загрузка списка групп...</p>}
                    </div>

                    <button type="submit" className={styles.button} disabled={isGenerating}>
                        {isGenerating ? 'Генерация...' : 'Сгенерировать'}
                    </button>
                    {modalMessage && <div className={`${styles.message} ${styles.success}`}>{modalMessage}</div>}
                    {modalError && <div className={`${styles.message} ${styles.error}`}>{modalError}</div>}
                </form>
            </Modal>
        </div>
    );
};

export default FinancePage;