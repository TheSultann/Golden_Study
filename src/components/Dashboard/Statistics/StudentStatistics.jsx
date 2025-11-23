import React, { useState } from 'react';
import styles from '../StudentDashboard/StudentDashboard.module.css';

const StudentStatistics = ({ stats, loading, error }) => {
    const [activeTab, setActiveTab] = useState('progress');

    const getMedal = (rank) => {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return '';
    };

    const getGradeColorClass = (grade) => {
        if (grade >= 80) return styles.gradeHigh;
        if (grade >= 50) return styles.gradeMedium;
        return styles.gradeLow;
    };

    if (loading) return <p>Loading statistics...</p>;
    if (error) return <p className={styles.errorText}>{error}</p>;
    if (!stats) return <p>No data to display.</p>;

    const { myEvaluations, rating } = stats;

    return (
        <div className={styles.statsWidget}>
            <div className={styles.statsTabContainer}>
                <button onClick={() => setActiveTab('progress')} className={activeTab === 'progress' ? styles.activeStatsTab : styles.statsTab}>
                    📈 My Progress
                </button>
                <button onClick={() => setActiveTab('rating')} className={activeTab === 'rating' ? styles.activeStatsTab : styles.statsTab}>
                    🏆 Rating
                </button>
            </div>

            {activeTab === 'progress' && (
                <div>
                    <h3 className={styles.statsTitle}>Lesson Grades</h3>
                    <table className={styles.progressTable}>
                        <thead>
                            <tr>
                                <th>LESSON AND DATE</th>
                                <th>RESULT</th>
                            </tr>
                        </thead>
                        <tbody>
                            {myEvaluations && myEvaluations.length > 0 ? myEvaluations.map(ev => (
                                <tr key={ev.lessonId}>
                                    <td data-label="Lesson and date">
                                        <div className={styles.lessonInfo}>
                                            <span>{ev.lessonTitle}</span>
                                            <span className={styles.lessonDate}>
                                                {new Date(ev.evaluationDate).toLocaleDateString('ru-RU')}
                                            </span>
                                        </div>
                                    </td>
                                    <td data-label="Result">
                                        <div className={styles.gradeCell}>
                                            <span className={`${styles.gradeIndicator} ${getGradeColorClass(ev.grade)}`}></span>
                                            <span className={styles.gradeValue}>{ev.grade}%</span>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="2" className={styles.noDataCell}>You don't have any grades yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'rating' && rating && (
                <div>
                    <div className={styles.ratingCardsContainer}>
                        <div className={styles.ratingCard}>
                            <div className={styles.ratingValue}>{getMedal(rating.myRank?.rank)} {rating.myRank?.rank || '?'} / {rating.totalStudents}</div>
                            <div className={styles.ratingLabel}>Rank in group</div>
                        </div>
                        <div className={styles.ratingCard}>
                            <div className={styles.ratingValue}>{rating.groupAverage.toFixed(1)}%</div>
                            <div className={styles.ratingLabel}>Group average grade</div>
                        </div>
                    </div>

                    {/* --- CHANGE: Header --- */}
                    <h3 className={styles.statsTitle}>Group Rating</h3>
                    <table className={styles.progressTable}>
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Name</th>
                                <th>Average Grade</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* --- CHANGE: Use fullRanking instead of top5 --- */}
                            {rating.fullRanking.map(user => (
                                <tr key={user.studentId} className={user.isCurrentUser ? styles.currentUserRow : ''}>
                                    <td data-label="Rank" className={styles.rankCell}>{getMedal(user.rank)} {user.rank}</td>
                                    <td data-label="Name">
                                        {user.studentName}
                                    </td>
                                    <td data-label="Average Grade">{user.averageGrade.toFixed(1)}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default StudentStatistics;