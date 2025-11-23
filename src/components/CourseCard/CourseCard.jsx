import React from 'react';
import styles from './CourseCard.module.css';
import { FiCalendar } from 'react-icons/fi';

const CourseCard = ({ lesson, onClick }) => {
    // --- CHANGE 1: Remove 'assignments', add 'group' ---
    const { title, group, dueDate, teacher } = lesson;
    
    // --- CHANGE 2: Completely replace logic. Show group instead of assignments. ---
    const description = group?.name || 'General lesson'; // Use ?. in case group didn't load

    const formattedDate = dueDate 
        ? new Date(dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) // Can use ru-RU
        : 'No date';

    return (
        <div className={styles.card} onClick={onClick}>
            <div className={styles.header}>
                <div className={styles.titleSection}>
                    <h3 className={styles.title}>{title}</h3>
                    {/* --- CHANGE 3: Now group name will be here --- */}
                    <p className={styles.assignment}>{description}</p>
                </div>
                <div className={styles.teacherAvatar}>
                    {teacher?.name?.charAt(0) || 'T'}
                </div>
            </div>

            <div className={styles.footer}>
                <span className={styles.dueDate}>
                    <FiCalendar /> Due: {formattedDate}
                </span>
                <div className={`${styles.scorePill} ${styles.pendingPill}`}>View</div>
            </div>

            <div className={styles.progressContainer}>
                <div className={styles.progressBar} style={{ width: '0%' }}></div>
            </div>
        </div>
    );
};

export default CourseCard;