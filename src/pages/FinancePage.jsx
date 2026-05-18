// src/pages/FinancePage.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styles from './FinancePage.module.css';
import API from '../api';
import Modal from '../components/Modal/Modal';
import { FiPlusCircle, FiTrendingUp, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
// --- 1. Import hook for context access ---
import { useStudentProfile } from '../context/StudentProfileContext';


// Helper to get current month in YYYY-MM format
const getCurrentMonth = () => new Date().toISOString().slice(0, 7);

// Component for statistics card
const StatCard = ({ icon, label, value, color }) => (
    <div className={styles.statCard}>
        <div className={styles.statIcon} style={{ backgroundColor: color }}>{icon}</div>
        <div className={styles.statContent}>
            <span className={styles.statValue}>{value}</span>
            <span className={styles.statLabel}>{label}</span>
        </div>
    </div>
);

// Component for status
const StatusIndicator = ({ status }) => {
    const config = {
        paid: { text: 'Paid', className: styles.statusPaid },
        unpaid: { text: 'Unpaid', className: styles.statusUnpaid },
        overdue: { text: 'Overdue', className: styles.statusOverdue }
    }[status] || { text: status };
    return <span className={`${styles.status} ${config.className}`}>{config.text}</span>;
};

const FinancePage = () => {
    // --- 2. Get function from context ---
    const { showProfile } = useStudentProfile();

    // Filter states
    const [periodStart, setPeriodStart] = useState(getCurrentMonth());
    const [periodEnd, setPeriodEnd] = useState(getCurrentMonth());
    const [selectedGroup, setSelectedGroup] = useState('all');

    // Data and UI states
    const [payments, setPayments] = useState([]);
    const [groupsForFilter, setGroupsForFilter] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [updatingPaymentId, setUpdatingPaymentId] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [totalCount, setTotalCount] = useState(0);

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalBillingPeriod, setModalBillingPeriod] = useState(getCurrentMonth());
    const [modalGroup, setModalGroup] = useState('all');
    const [groupAmounts, setGroupAmounts] = useState({});
    const [modalMessage, setModalMessage] = useState('');
    const [modalError, setModalError] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const fetchPayments = useCallback(async (page = currentPage) => {
        if (!periodStart || !periodEnd) return;
        setIsLoading(true);
        setError('');
        try {
            const url = `/api/finance?periodStart=${periodStart}&periodEnd=${periodEnd}&groupId=${selectedGroup}&page=${page}&limit=50`;
            const response = await API.get(url);
            setPayments(response.data.payments);
            setTotalPages(response.data.totalPages);
            setTotalCount(response.data.total);
            setCurrentPage(response.data.page);
        } catch (err) {
            setError('Failed to load invoices.');
        } finally {
            setIsLoading(false);
        }
    }, [periodStart, periodEnd, selectedGroup, currentPage]);

    useEffect(() => {
        fetchPayments();
    }, [fetchPayments]);

    useEffect(() => {
        const fetchGroups = async () => {
            try {
                const response = await API.get('/api/groups/all');
                setGroupsForFilter(response.data);
            } catch (err) { console.error("Failed to load groups:", err); }
        };
        fetchGroups();
    }, []);

    useEffect(() => {
        const fetchLastAmounts = async () => {
            try {
                const response = await API.get('/api/finance/last-amounts');
                // Normalize to digits-only strings for consistent state
                const normalized = Object.fromEntries(
                    Object.entries(response.data).map(([id, val]) => [id, String(Math.round(Number(val)))])
                );
                setGroupAmounts(normalized);
            } catch (error) {
                console.error("Failed to load last amounts:", error);
            }
        };

        if (isModalOpen) {
            fetchLastAmounts();
        }
    }, [isModalOpen]);

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

    const handleMarkAsPaid = async (paymentId) => {
        if (!window.confirm('Mark this invoice as paid? This action cannot be undone.')) return;
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

    const handleGenerateInvoices = async (e) => {
        e.preventDefault();
        setIsGenerating(true);
        setModalMessage('');
        setModalError('');

        const finalGroupAmounts = Object.fromEntries(
            Object.entries(groupAmounts)
                .filter(([id]) => modalGroup === 'all' || id === modalGroup)
                .map(([id, val]) => [id, parseSum(val)])
                .filter(([_, amount]) => amount !== '' && Number(amount) > 0)
        );

        if (Object.keys(finalGroupAmounts).length === 0) {
            setModalError('Please specify an amount for at least one group.');
            setIsGenerating(false);
            return;
        }

        try {
            const response = await API.post('/api/finance/generate', {
                billingPeriod: modalBillingPeriod,
                groupAmounts: finalGroupAmounts
            });
            setModalMessage(`Success! Created ${response.data.createdCount} new invoice(s).`);
            await fetchPayments();
            setTimeout(() => {
                setIsModalOpen(false);
                setModalMessage('');
                setGroupAmounts({});
            }, 2000);
        } catch (err) {
            setModalError(err.response?.data?.message || 'An error occurred.');
        } finally {
            setIsGenerating(false);
        }
    };
    
    /**
     * Parses user input into a clean integer.
     * Accepts: "500000", "500.000", "500 000" → 500000
     */
    const parseSum = (value) => {
        const cleaned = String(value).replace(/[\s.]/g, '');
        const parsed = parseInt(cleaned, 10);
        return isNaN(parsed) ? '' : parsed;
    };

    /**
     * Formats a number for display: 500000 → "500.000"
     * Input is always a digits-only string from state.
     */
    const formatSum = (value) => {
        const num = parseInt(String(value).replace(/\D/g, ''), 10);
        if (isNaN(num) || num === 0) return '';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    };

    const handleAmountChange = (groupId, value) => {
        // Allow only digits while typing (strip everything else)
        const digits = value.replace(/\D/g, '');
        setGroupAmounts(prev => ({
            ...prev,
            [groupId]: digits
        }));
    };

    const handleAmountBlur = (groupId, value) => {
        // On blur: clean up leading zeros
        const digits = String(value).replace(/\D/g, '');
        const parsed = parseInt(digits, 10);
        setGroupAmounts(prev => ({
            ...prev,
            [groupId]: isNaN(parsed) || parsed === 0 ? '' : String(parsed)
        }));
    };

    const formatCurrency = (amount) => {
        const num = Math.round(Number(amount));
        if (isNaN(num)) return '0 сум';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' сум';
    };

    return (
        <div className={styles.dashboardWrapper}>
            <header className={styles.header}>
                <div>
                    <h1>Finance Dashboard</h1>
                    <p>Overview of financial activity and invoice management.</p>
                </div>
                <button className={styles.actionButton} onClick={() => setIsModalOpen(true)}>
                    <FiPlusCircle /> Generate Invoices
                </button>
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
                                        {/* --- 3. Make student name clickable --- */}
                                        <td>
                                            {p.student ? (
                                                <span 
                                                    className={styles.clickableStudentName} 
                                                    onClick={() => showProfile(p.student._id)}
                                                >
                                                    {p.student.name}
                                                </span>
                                            ) : 'N/A'}
                                        </td>
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
                    {totalPages > 1 && (
                        <div className={styles.pagination}>
                            <button
                                className={styles.pageButton}
                                disabled={currentPage <= 1}
                                onClick={() => fetchPayments(currentPage - 1)}
                            >
                                Previous
                            </button>
                            <span className={styles.pageInfo}>
                                Page {currentPage} of {totalPages} ({totalCount} total)
                            </span>
                            <button
                                className={styles.pageButton}
                                disabled={currentPage >= totalPages}
                                onClick={() => fetchPayments(currentPage + 1)}
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <Modal isOpen={isModalOpen} onRequestClose={() => setIsModalOpen(false)} title="Generate Invoices">
                <form onSubmit={handleGenerateInvoices} className={styles.modalForm}>
                    <p>Select the billing month, group, and specify the amount per group.</p>
                    
                    <div className={styles.formGroup}>
                        <label htmlFor="modalBillingPeriod">Billing month</label>
                        <input type="month" id="modalBillingPeriod" value={modalBillingPeriod} onChange={e => setModalBillingPeriod(e.target.value)} className={styles.input} required />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="modalGroupSelect">Group</label>
                        <select id="modalGroupSelect" value={modalGroup} onChange={e => setModalGroup(e.target.value)} className={styles.input}>
                            <option value="all">All Groups</option>
                            {groupsForFilter.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
                        </select>
                    </div>

                    <div className={styles.groupAmountsGrid}>
                        {groupsForFilter.length > 0 ? groupsForFilter
                            .filter(group => modalGroup === 'all' || group._id === modalGroup)
                            .map(group => (
                            <div key={group._id} className={styles.groupAmountItem}>
                                <label htmlFor={`group-amount-${group._id}`}>{group.name}</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    id={`group-amount-${group._id}`}
                                    placeholder="0 сум"
                                    className={styles.input}
                                    value={groupAmounts[group._id] ? formatSum(groupAmounts[group._id]) : ''}
                                    onChange={e => handleAmountChange(group._id, e.target.value)}
                                    onBlur={e => handleAmountBlur(group._id, e.target.value)}
                                />
                            </div>
                        )) : <p>Loading groups...</p>}
                    </div>

                    <button type="submit" className={styles.button} disabled={isGenerating}>
                        {isGenerating ? 'Generating...' : 'Generate'}
                    </button>
                    {modalMessage && <div className={`${styles.message} ${styles.success}`}>{modalMessage}</div>}
                    {modalError && <div className={`${styles.message} ${styles.error}`}>{modalError}</div>}
                </form>
            </Modal>
        </div>
    );
};

export default FinancePage;