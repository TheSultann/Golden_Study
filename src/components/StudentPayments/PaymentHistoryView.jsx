import React from 'react';
import { FiLoader, FiAlertCircle, FiRefreshCw, FiInbox } from 'react-icons/fi';
import styles from './PaymentHistoryView.module.css';

/**
 * Formats a billingPeriod string "YYYY-MM" as a locale-aware month and year.
 * e.g. "2026-05" → "May 2026" (en) or "Май 2026" (ru)
 */
function formatBillingPeriod(billingPeriod) {
    const [year, month] = billingPeriod.split('-');
    const date = new Date(Number(year), Number(month) - 1);
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/**
 * Formats a number as Uzbek sum: 500.000 (dot as thousands separator, no decimals)
 */
function formatSum(value) {
    return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Returns the CSS module class for a given payment status.
 */
function getStatusClass(status) {
    switch (status) {
        case 'paid':
            return styles.statusPaid;
        case 'unpaid':
            return styles.statusPending;
        case 'overdue':
            return styles.statusOverdue;
        default:
            return styles.statusDefault;
    }
}

/**
 * Returns a human-readable label for a payment status.
 */
function getStatusLabel(status) {
    switch (status) {
        case 'paid':
            return 'Paid';
        case 'unpaid':
            return 'Pending';
        case 'overdue':
            return 'Overdue';
        default:
            return status;
    }
}

const PaymentHistoryView = ({ payments, loading, error, onRetry }) => {
    const hasData = Array.isArray(payments) && payments.length > 0;

    // Sort payments by billingPeriod descending (newest first)
    const sortedPayments = hasData
        ? [...payments].sort((a, b) => b.billingPeriod.localeCompare(a.billingPeriod))
        : [];

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>Payment History</h2>

            {loading && (
                <div className={styles.loading}>
                    <FiLoader className={styles.spinner} />
                    <span>Loading payment history...</span>
                </div>
            )}

            {error && (
                <div className={styles.error}>
                    <FiAlertCircle size={20} />
                    <span>{error}</span>
                    <button className={styles.retryButton} onClick={onRetry}>
                        <FiRefreshCw size={14} />
                        Retry
                    </button>
                </div>
            )}

            {/* Preserve previously displayed data even when error is set */}
            {hasData && (
                <div className={styles.list}>
                    {sortedPayments.map((payment) => (
                        <div key={payment.billingPeriod} className={styles.record}>
                            <div className={styles.periodBlock}>
                                <span className={styles.period}>
                                    {formatBillingPeriod(payment.billingPeriod)}
                                </span>
                                {payment.groupName && (
                                    <span className={styles.groupName}>{payment.groupName}</span>
                                )}
                            </div>
                            <div className={styles.amounts}>
                                <div className={styles.amountBlock}>
                                    <span className={styles.amountLabel}>Due</span>
                                    <span className={styles.amountValue}>
                                        {formatSum(payment.amountDue)} сум
                                    </span>
                                </div>
                                <div className={styles.amountBlock}>
                                    <span className={styles.amountLabel}>Paid</span>
                                    <span className={styles.amountValue}>
                                        {formatSum(payment.amountPaid)} сум
                                    </span>
                                </div>
                            </div>
                            <span className={`${styles.statusBadge} ${getStatusClass(payment.status)}`}>
                                {getStatusLabel(payment.status)}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Empty state: no data, not loading, no error */}
            {!hasData && !loading && !error && (
                <div className={styles.empty}>
                    <FiInbox className={styles.emptyIcon} size={32} />
                    <span>No payment records found.</span>
                </div>
            )}
        </div>
    );
};

export default PaymentHistoryView;
