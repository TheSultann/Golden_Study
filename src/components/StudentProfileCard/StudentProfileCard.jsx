import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../Modal/Modal';
import API from '../../api';
import styles from './StudentProfileCard.module.css';
import { Line, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
    Title, Tooltip, Legend, ArcElement
} from 'chart.js';
import { FiCheckCircle, FiClock, FiAlertCircle, FiFileText } from 'react-icons/fi';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement);

const LoadingSpinner = () => <div className={styles.loader}></div>;
const ErrorDisplay = ({ message }) => <div className={styles.error}>Error: {message}</div>;

const StudentProfileCard = ({ studentId, onClose }) => {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!studentId) return;
        const fetchProfile = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await API.get(`/api/student/${studentId}/profile`);
                setProfile(res.data);
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to load profile');
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [studentId]);

    const chartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
        },
        scales: {
            y: { beginAtZero: true, ticks: { font: { size: 10 } } },
            x: { ticks: { font: { size: 10 } } },
        },
    }), []);

    const progressChartData = useMemo(() => ({
        labels: profile?.detailedData?.progressChart.map(p => p.lesson.substring(0, 15)) || [],
        datasets: [{
            label: 'Grade',
            data: profile?.detailedData?.progressChart.map(p => p.grade) || [],
            fill: true,
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderColor: '#3b82f6',
            tension: 0.3,
            pointBackgroundColor: '#3b82f6',
        }],
    }), [profile]);

    const attendanceChartData = useMemo(() => ({
        labels: ['Present', 'Absent'],
        datasets: [{
            data: [
                profile?.keyMetrics?.attendance.present || 0,
                (profile?.keyMetrics?.attendance.total || 0) - (profile?.keyMetrics?.attendance.present || 0)
            ],
            backgroundColor: ['#10B981', '#F43F5E'],
            borderColor: ['#ffffff'],
            borderWidth: 2,
            hoverOffset: 4,
        }],
    }), [profile]);

    // --- FIXED CHART AND FINANCE BLOCK ---
    const doughnutOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%', // Make the "donut" thinner
        plugins: {
            legend: { display: false },
            tooltip: { enabled: false } // Disable default tooltip
        }
    }), []);

    const financialInfo = useMemo(() => {
        const finStatus = profile?.keyMetrics?.financialStatus;
        if (!finStatus) return { icon: <FiFileText />, text: 'Invoice not issued', details: null, className: styles.statusDefault };

        switch (finStatus.status) {
            case 'paid': return { icon: <FiCheckCircle />, text: finStatus.message, details: null, className: styles.statusPaid };
            case 'pending': return { icon: <FiClock />, text: finStatus.message, details: finStatus.details, className: styles.statusPending };
            case 'overdue': return { icon: <FiAlertCircle />, text: finStatus.message, details: finStatus.details, className: styles.statusOverdue };
            default: return { icon: <FiFileText />, text: 'Invoice not issued', details: null, className: styles.statusDefault };
        }
    }, [profile]);
    // --- END OF FIXED BLOCK ---

    return (
        <Modal isOpen={!!studentId} onRequestClose={onClose} title="" modalClassName={styles.profileModal}>
            <div className={styles.profileContainer}>
                {loading && <LoadingSpinner />}
                {error && <ErrorDisplay message={error} />}
                {profile && !loading && !error && (
                    <>
                        <header className={styles.profileHeader}>
                            <div className={styles.avatar}>{profile.name.charAt(0)}</div>
                            <div className={styles.headerInfo}>
                                <h2>{profile.name}</h2>
                                <p>{profile.email}</p>
                            </div>
                            <div className={styles.averageGrade}>
                                <span>Average grade</span>
                                <strong>{profile.keyMetrics.averageGrade}</strong>
                            </div>
                        </header>

                        <div className={styles.contentGrid}>
                            <div className={`${styles.widgetCard} ${styles.attendanceCard}`}>
                                <h4>Attendance</h4>
                                <div className={styles.attendanceContent}>
                                    <div className={styles.doughnutChart}>
                                        <Doughnut data={attendanceChartData} options={doughnutOptions} />
                                        <div className={styles.doughnutCenterText}>
                                            <strong>{profile.keyMetrics.attendance.percentage}%</strong>
                                        </div>
                                    </div>
                                    <div className={styles.attendanceLegend}>
                                        <div className={styles.legendItem}>
                                            <span className={`${styles.legendDot} ${styles.dotPresent}`}></span>
                                            Attended: {profile.keyMetrics.attendance.present}
                                        </div>
                                        <div className={styles.legendItem}>
                                            <span className={`${styles.legendDot} ${styles.dotAbsent}`}></span>
                                            Missed: {profile.keyMetrics.attendance.total - profile.keyMetrics.attendance.present}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className={`${styles.widgetCard} ${styles.financeCard} ${financialInfo.className}`}>
                                <h4>Finances (current month)</h4>
                                <div className={styles.financeContent}>
                                    <div className={styles.financeIcon}>{financialInfo.icon}</div>
                                    <p>{financialInfo.text}</p>
                                    {financialInfo.details && <span className={styles.financeDetails}>{financialInfo.details}</span>}
                                </div>
                            </div>

                            <div className={`${styles.widgetCard} ${styles.progressCard}`}>
                                <h4>Progress trends</h4>
                                <div className={styles.lineChart}>
                                    {profile.detailedData.progressChart.length > 1 ? (
                                        <Line data={progressChartData} options={chartOptions} />
                                    ) : (
                                        <div className={styles.noChartData}>Insufficient data to build chart.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};

export default StudentProfileCard;