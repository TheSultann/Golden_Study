import React, { useState, useEffect } from 'react';
import styles from '../TeacherDashboard/TeacherDashboard.module.css';

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
            const token = localStorage.getItem('userToken'); 
            if (!token) return;
            setLoading(true);
            try {
                const res = await fetch(`/api/stats/group/${selectedGroup}`,  {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                const data = await res.json();

                if (res.ok && Array.isArray(data)) {
                    setStudentStats(data);
                    
                    if (data.length > 0) {
                        const totalAverage = data.reduce((acc, curr) => acc + curr.averageGrade, 0);
                        const avg = Math.round(totalAverage / data.length);
                        setGroupAverage(avg);
                    } else {
                        setGroupAverage(0);
                    }
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
        fetchStats();
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
                <label htmlFor="group-select">Выберите группу:</label>
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
                        <div className={styles.groupAverageTitle}>Средняя успеваемость по группе</div>
                        <div className={styles.groupAverageValue}>{groupAverage}%</div>
                    </div>
                    <table className={styles.statsTable}>
                        <thead>
                            <tr>
                                <th>Место</th>
                                <th>Ученик</th>
                                <th>Средняя оценка (%)</th>
                                <th>Всего уроков</th>
                                <th>Последняя оценка</th>
                            </tr>
                        </thead>
                        <tbody>
                            {studentStats.length > 0 ? studentStats.map((stat, index) => (
                                <tr key={stat.studentId}>
                                    <td data-label="Место" className={styles.rankCell}>{getMedal(index + 1)} {index + 1}</td>
                                    <td data-label="Ученик">{stat.studentName}</td>
                                    <td data-label="Средняя оценка (%)">{stat.averageGrade}%</td>
                                    <td data-label="Всего уроков">{stat.lessonCount}</td>
                                    <td data-label="Последняя оценка">{stat.lastGrade !== null ? `${stat.lastGrade}%` : 'N/A'}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="5" className={styles.noDataCell}>
                                        Нет данных для отображения. У учеников в этой группе еще нет оценок.
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