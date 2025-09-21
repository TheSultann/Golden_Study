import React, { useState, useEffect, useMemo } from 'react';
import styles from './TeachersOverviewPage.module.css';
import API from '../api';
import { FiUsers, FiUserCheck, FiBookOpen, FiArrowLeft } from 'react-icons/fi';

const StatCard = ({ icon, label, value }) => (
    <div className={styles.statCard}>
        <div className={styles.statIcon}>{icon}</div>
        <div className={styles.statContent}>
            <span className={styles.statValue}>{value}</span>
            <span className={styles.statLabel}>{label}</span>
        </div>
    </div>
);

const TeachersOverviewPage = () => {
    const [overviewData, setOverviewData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedTeacher, setSelectedTeacher] = useState(null);

    // --- ДОБАВЛЕНО: Получаем имя администратора из localStorage ---
    const adminName = localStorage.getItem('userName');

    useEffect(() => {
        const fetchOverview = async () => {
            try {
                const res = await API.get('/api/overview/teachers');
                setOverviewData(res.data);
            } catch (err) {
                setError('Failed to load overview data.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchOverview();
    }, []);

    const generalStats = useMemo(() => {
        const totalStudents = overviewData.reduce((sum, teacher) => sum + teacher.totalStudents, 0);
        const totalGroups = overviewData.reduce((sum, teacher) => sum + teacher.groupCount, 0);
        return {
            totalTeachers: overviewData.length,
            totalStudents,
            totalGroups
        };
    }, [overviewData]);

    if (isLoading) return <p>Loading dashboard...</p>;
    if (error) return <p className={styles.error}>{error}</p>;

    if (selectedTeacher) {
        return (
            <div className={styles.wrapper}>
                <button onClick={() => setSelectedTeacher(null)} className={styles.backButton}>
                    <FiArrowLeft /> Back to Overview
                </button>
                <header className={styles.header}>
                    <h1>{selectedTeacher.name}'s Groups</h1>
                    <p>Detailed performance of each group.</p>
                </header>
                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Group Name</th>
                                <th>Student Count</th>
                                <th>Average Grade</th>
                            </tr>
                        </thead>
                        <tbody>
                            {selectedTeacher.groups.map(group => (
                                <tr key={group._id}>
                                    <td>{group.name}</td>
                                    <td>{group.studentCount}</td>
                                    <td>{group.averageGrade.toFixed(1)}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.wrapper}>
            {/* --- ИЗМЕНЕНО: Заголовок теперь персонализирован --- */}
            <header className={styles.header}>
                <h1>Hello, {adminName}!</h1>
                <p>Here is the performance and statistics of the teaching staff.</p>
            </header>
            {/* --- КОНЕЦ ИЗМЕНЕНИЯ --- */}

            <div className={styles.statsGrid}>
                <StatCard icon={<FiUserCheck />} label="Total Teachers" value={generalStats.totalTeachers} />
                <StatCard icon={<FiUsers />} label="Total Students" value={generalStats.totalStudents} />
                <StatCard icon={<FiBookOpen />} label="Total Groups" value={generalStats.totalGroups} />
            </div>

            <div className={styles.teachersGrid}>
                {overviewData.map(teacher => (
                    <div key={teacher._id} className={styles.teacherCard} onClick={() => setSelectedTeacher(teacher)}>
                        <h3 className={styles.teacherName}>{teacher.name}</h3>
                        <div className={styles.teacherStats}>
                            <span>Groups: <strong>{teacher.groupCount}</strong></span>
                            <span>Students: <strong>{teacher.totalStudents}</strong></span>
                        </div>
                        <div className={styles.performance}>
                            <span className={styles.performanceLabel}>Overall Performance</span>
                            <span className={styles.performanceValue}>{teacher.overallAverageGrade.toFixed(1)}%</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TeachersOverviewPage;