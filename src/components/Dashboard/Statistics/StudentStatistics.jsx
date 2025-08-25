import React, { useState } from 'react';
import styles from '../StudentDashboard/StudentDashboard.module.css';

const StudentStatistics = ({ stats, loading, error }) => {
    const [activeTab, setActiveTab] = useState('progress');
    const myUserId = localStorage.getItem('userId');

    const getMedal = (rank) => {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return '';
    };

    // --- НОВАЯ ФУНКЦИЯ ДЛЯ ЦВЕТОВОГО ИНДИКАТОРА ---
    const getGradeColorClass = (grade) => {
        if (grade >= 80) return styles.gradeHigh;
        if (grade >= 50) return styles.gradeMedium;
        return styles.gradeLow;
    };

    if (loading) return <p>Загрузка статистики...</p>;
    if (error) return <p className={styles.errorText}>{error}</p>;
    if (!stats) return <p>Нет данных для отображения.</p>;

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
                    {/* --- ПОЛНОСТЬЮ ПЕРЕДЕЛАННАЯ ТАБЛИЦА --- */}
                    <table className={styles.progressTable}>
                        <thead>
                            <tr>
                                <th>LESSON & DATE</th>
                                <th>RESULT</th>
                            </tr>
                        </thead>
                        <tbody>
                            {myEvaluations && myEvaluations.length > 0 ? myEvaluations.map(ev => (
                                <tr key={ev.lessonId}>
                                    <td data-label="Урок и дата">
                                        <div className={styles.lessonInfo}>
                                            <span>{ev.lessonTitle}</span>
                                            <span className={styles.lessonDate}>
                                                {new Date(ev.evaluationDate).toLocaleDateString('ru-RU')}
                                            </span>
                                        </div>
                                    </td>
                                    <td data-label="Результат">
                                        <div className={styles.gradeCell}>
                                            <span className={`${styles.gradeIndicator} ${getGradeColorClass(ev.grade)}`}></span>
                                            <span className={styles.gradeValue}>{ev.grade}%</span>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="2" className={styles.noDataCell}>У вас еще нет оценок.</td>
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
                            <div className={styles.ratingLabel}>место в группе</div>
                        </div>
                        <div className={styles.ratingCard}>
                            <div className={styles.ratingValue}>{rating.groupAverage}%</div>
                            <div className={styles.ratingLabel}>средняя оценка по группе</div>
                        </div>
                    </div>

                    <h3 className={styles.statsTitle}>Топ-5 учеников</h3>
                    <table className={styles.progressTable}>
                        <thead>
                            <tr>
                                <th>Место</th>
                                <th>Имя</th>
                                <th>Средняя оценка</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rating.top5.map(user => (
                                <tr key={user.studentId} className={user.studentId === myUserId ? styles.currentUserRow : ''}>
                                    <td data-label="Место" className={styles.rankCell}>{getMedal(user.rank)} {user.rank}</td>
                                    <td data-label="Имя">{user.studentName} {user.studentId === myUserId ? '(это ты)' : ''}</td>
                                    <td data-label="Средняя оценка">{user.averageGrade}%</td>
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