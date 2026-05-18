import React from 'react';
import styles from './CurrentStatusCard.module.css';
import { FiCheckCircle, FiClock, FiAlertCircle, FiFileText } from 'react-icons/fi';

/**
 * Formats a number as Uzbek sum: 500.000 (dot as thousands separator, no decimals)
 */
function formatSum(value) {
    return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Formats a date string as d.M.yyyy (e.g. 18.5.2026)
 */
function formatDate(dateStr) {
    const d = new Date(dateStr);
    return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

const CurrentStatusCard = ({ payment, loading, error, onRetry }) => {
    if (loading) {
        return (
            <div className={styles.card}>
                <div className={styles.loading}>
                    <div className={styles.spinner}></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.card}>
                <div className={styles.error}>
                    <p className={styles.errorMessage}>{error}</p>
                    <button className={styles.retryButton} onClick={onRetry}>
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!payment) {
        return (
            <div className={styles.card}>
                <div className={styles.statusContent}>
                    <div className={`${styles.iconWrapper} ${styles.statusDefault}`}>
                        <FiFileText size={24} />
                    </div>
                    <div className={styles.details}>
                        <p className={styles.message}>No invoice has been issued for this period</p>
                    </div>
                </div>
            </div>
        );
    }

    const { status, amountDue, amountPaid, paymentDate } = payment;

    if (status === 'paid') {
        return (
            <div className={styles.card}>
                <div className={styles.statusContent}>
                    <div className={`${styles.iconWrapper} ${styles.statusPaid}`}>
                        <FiCheckCircle size={24} />
                    </div>
                    <div className={styles.details}>
                        <p className={styles.statusLabel}>Paid</p>
                        <p className={styles.amount}>{formatSum(amountPaid)} сум</p>
                        {paymentDate && (
                            <p className={styles.date}>
                                {formatDate(paymentDate)}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (status === 'overdue') {
        return (
            <div className={styles.card}>
                <div className={styles.statusContent}>
                    <div className={`${styles.iconWrapper} ${styles.statusOverdue}`}>
                        <FiAlertCircle size={24} />
                    </div>
                    <div className={styles.details}>
                        <p className={styles.statusLabel}>Overdue</p>
                        <p className={styles.amount}>{formatSum(amountDue)} сум</p>
                    </div>
                </div>
            </div>
        );
    }

    // Default: unpaid/pending
    return (
        <div className={styles.card}>
            <div className={styles.statusContent}>
                <div className={`${styles.iconWrapper} ${styles.statusPending}`}>
                    <FiClock size={24} />
                </div>
                <div className={styles.details}>
                    <p className={styles.statusLabel}>Pending</p>
                    <p className={styles.amount}>{formatSum(amountDue)} сум</p>
                </div>
            </div>
        </div>
    );
};

export default CurrentStatusCard;
