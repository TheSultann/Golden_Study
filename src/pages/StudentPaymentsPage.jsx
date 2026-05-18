import React, { useState, useEffect, useCallback } from 'react';
import styles from './StudentPaymentsPage.module.css';
import API from '../api';
import CurrentStatusCard from '../components/StudentPayments/CurrentStatusCard';
import PaymentHistoryView from '../components/StudentPayments/PaymentHistoryView';

const StudentPaymentsPage = () => {
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchPayments = useCallback(async () => {
        setError(null);
        setLoading(true);
        try {
            const response = await API.get('/api/finance/my-payments', { timeout: 10000 });
            setPayments(response.data);
        } catch (err) {
            const message =
                err.code === 'ECONNABORTED'
                    ? 'Request timed out. Please try again.'
                    : err.response?.data?.message || 'Failed to load payment data.';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPayments();
    }, [fetchPayments]);

    // Derive current month payment
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentPayment = payments.find(p => p.billingPeriod === currentPeriod) || null;

    return (
        <div className={styles.pageWrapper}>
            <header className={styles.header}>
                <h1>My Payments</h1>
            </header>
            <div className={styles.content}>
                <CurrentStatusCard
                    payment={currentPayment}
                    loading={loading}
                    error={error}
                    onRetry={fetchPayments}
                />
                <PaymentHistoryView
                    payments={payments}
                    loading={loading}
                    error={error}
                    onRetry={fetchPayments}
                />
            </div>
        </div>
    );
};

export default StudentPaymentsPage;
