// src/components/Dashboard/Statistics/GroupStatistics.jsx (ИСПРАВЛЕННЫЙ)

import React, { useState, useEffect } from 'react';
import styles from '../TeacherDashboard/TeacherDashboard.module.css';
import API from '../../../api';

const GroupStatistics = ({ groups }) => {
    const [selectedGroup, setSelectedGroup] = useState('');
    const [studentStats, setStudentStats] = useState([]);
    const [groupAverage, setGroupAverage] = useState(0);
    const [loading, setLoading] = useState(false);
    
    useEffect(() => {
        if (groups.length > 0 && !selectedGroup) {
            setSelectedGroup(groups[0]._id);
        }
    }, [groups, selectedGroup]);

    useEffect(() => {
        const fetchStats = async () => {
            if (!selectedGroup) return;

            setLoading(true);
            try {
                const res = await API.get(`/api/stats/group/${selectedGroup}`);
                const { studentStats: newStudentStats, groupAverage: newGroupAverage } = res.data;

                if (newStudentStats && typeof newGroupAverage !== 'undefined') {
                    setStudentStats(newStudentStats);
                    // --- ИЗМЕНЕНИЕ ЗДЕСЬ: Убираем Math.round, сохраняем точное значение ---
                    setGroupAverage(newGroupAverage); 
                } else {
                    console.error("Ошибка загрузки статистики или неверный формат данных");
                    setStudentStats([]);
                    setGroupAverage(0);
                }

            } catch (err) {
                console.error(err);
                setStudentStats([]);
                setGroupAverage(0);
            } finally {
                setLoading(false);
            }
        };
        
        const token = localStorage.getItem('userToken'); 
        if (token) {
            fetchStats();
        }
    }, [selectedGroup]);

    const getMedal = (rank) => {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return '';
    };

    return (
        <div className={styles.statsContainer}>
            <div className={styles.groupSelector}>
                <label htmlFor="group-select">Select group:</label>
                <select 
                    id="group-select" 
                    value={selectedGroup} 
                    onChange={(e) => setSelectedGroup(e.target.value)} 
                    disabled={groups.length === 0}
                >
                    {groups.map(group => (<option key={group._id} value={group._id}>{group.name}</option>))}
                </select>
            </div>
            
            {loading ? <p>Загрузка...</p> : (
                <>
                    <div className={styles.groupAverageCard}>
                        <div className={styles.groupAverageTitle}>AVERAGE GROUP PERFORMANCE</div>
                        {/* --- ИЗМЕНЕНИЕ ЗДЕСЬ: Форматируем вывод до 2 знаков после запятой --- */}
                        <div className={styles.groupAverageValue}>{groupAverage.toFixed(1)}%</div>
                    </div>
                    <table className={styles.statsTable}>
                        <thead>
                            <tr>
                                <th>RANK</th>
                                <th>STUDENT</th>
                                <th>AVERAGE GRADE (%)</th>
                                <th>TOTAL LESSONS</th>
                                <th>LAST GRADE</th>
                            </tr>
                        </thead>
                        <tbody>
                            {studentStats.length > 0 ? studentStats.map((stat) => (
                                <tr key={stat.studentId}>
                                    <td data-label="Rank" className={styles.rankCell}>{getMedal(stat.rank)} {stat.rank}</td>
                                    <td data-label="Student">{stat.studentName}</td>
                                    <td data-label="Average Grade (%)">{stat.averageGrade.toFixed(1)}%</td>
                                    <td data-label="Total Lessons">{stat.lessonCount}</td>
                                    <td data-label="Last Grade">{stat.lastGrade !== null ? `${stat.lastGrade}%` : 'N/A'}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="5" className={styles.noDataCell}>
                                    No data to display. Students in this group do not have grades yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </>
            )}
        </div>
    );
};

export default GroupStatistics;