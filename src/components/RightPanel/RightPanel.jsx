import React from 'react';
import styles from './RightPanel.module.css';
import { FiAward, FiBarChart2, FiCheckCircle, FiChevronRight } from 'react-icons/fi';
import ActivityChart from '../ActivityChart/ActivityChart';
import { studentData, teacherData } from '../../data/mockData'; // Импортируем ОБА набора данных

// Компонент теперь принимает isTeacherView как пропс
const RightPanel = ({ isTeacherView }) => {

    // ===================================
    //   ВИД ДЛЯ УЧИТЕЛЯ
    // ===================================
    if (isTeacherView) {
        const { statistics } = teacherData;
        return (
            <aside className={`${styles.rightPanel} ${styles.teacherView}`}>
                <div className={styles.section}>
                    <h4 className={styles.sectionHeader}>Statistics</h4>
                    <div className={styles.statItem}>
                        <span>Average Performance</span>
                        <strong>{statistics.averagePerformance}</strong>
                    </div>
                    <div className={styles.statItem}>
                        <span>Top Students</span>
                        <strong>{statistics.topStudents.map(s => s.name).join(', ')}</strong>
                    </div>
                </div>

                <div className={styles.section}>
                    <h4 className={styles.sectionHeader}>Performance Overview</h4>
                    <ActivityChart data={statistics.performanceOverview} />
                </div>
            </aside>
        )
    }

    // ===================================
    //   ВИД ДЛЯ УЧЕНИКА (по умолчанию)
    // ===================================
    const { name, lessons, progress, skills, rankings } = studentData;
    const upcomingTasks = lessons.filter(lesson => lesson.score === null);
    const completedLessons = lessons.length - upcomingTasks.length;

    return (
        <aside className={styles.rightPanel}>
            {/* 1. Карточка профиля */}
            <div className={styles.profileCard}>
                <div className={styles.profileBanner}>
                    <img src="/images/profile-bg.jpg" alt="Profile background"/>
                </div>
                <img className={styles.profileAvatar} src="/images/avatar-siti.jpg" alt={name} />
                <h3 className={styles.profileName}>{name} <span className={styles.verified}>✔</span></h3>
                <p className={styles.profileHandle}>@student</p>
                <div className={styles.profileStats}>
                    <div className={styles.stat}>
                        <FiCheckCircle/>
                        <span>{completedLessons}</span>
                        <p>Completed</p>
                    </div>
                    <div className={styles.stat}>
                        <FiAward/>
                        <span>#{rankings.position}</span>
                        <p>Rank</p>
                    </div>
                    <div className={styles.stat}>
                        <FiBarChart2/>
                        <span>{progress.averageScore}%</span>
                        <p>Avg. Score</p>
                    </div>
                </div>
            </div>

            {/* 2. Блок прогресса */}
            <div className={styles.section}>
                <div className={styles.sectionHeader}>
                    <h4>My Progress</h4>
                    <div className={styles.dropdown}>Last month ▼</div>
                </div>
                <ActivityChart data={progress.chartData} />
            </div>

            {/* 3. Блок Навыки (Skills) */}
            <div className={styles.section}>
                <div className={styles.sectionHeader}>
                    <h4>Skills</h4>
                </div>
                <div className={styles.skillsList}>
                    {Object.entries(skills).map(([skill, value]) => (
                        <div className={styles.skillItem} key={skill}>
                            <span className={styles.skillName}>{skill.charAt(0).toUpperCase() + skill.slice(1)}</span>
                            <div className={styles.skillBarContainer}>
                                <div className={styles.skillBar} style={{ width: `${value}%` }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 4. Блок "Upcoming Task" */}
            <div className={styles.section}>
                <div className={styles.sectionHeader}>
                    <h4>Upcoming Task</h4>
                    <a href="#">See all</a>
                </div>
                <ul className={styles.taskList}>
                    {upcomingTasks.map(task => (
                        <li key={task.id} className={styles.taskItem}>
                            <div className={styles.taskIcon} style={{backgroundColor: '#E0F7FA'}}>📚</div>
                            <div className={styles.taskDetails}>
                                <h5>{task.title}</h5>
                                <p>Due: {task.dueDate}</p>
                            </div>
                            <FiChevronRight />
                        </li>
                    ))}
                </ul>
            </div>
        </aside>
    );
};

export default RightPanel;
