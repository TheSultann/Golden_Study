import React from 'react';
import styles from './CourseCard.module.css';
import { FiCalendar } from 'react-icons/fi';

const CourseCard = ({ lesson, onClick }) => {
    // --- ИЗМЕНЕНИЕ 1: Убираем 'assignments', добавляем 'group' ---
    const { title, group, dueDate, teacher } = lesson;
    
    // --- ИЗМЕНЕНИЕ 2: Полностью заменяем логику. Вместо заданий показываем группу. ---
    const description = group?.name || 'General lesson'; // Используем ?. на случай, если группа не подгрузилась

    const formattedDate = dueDate 
        ? new Date(dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) // Можно использовать ru-RU
        : 'No date';

    return (
        <div className={styles.card} onClick={onClick}>
            <div className={styles.header}>
                <div className={styles.titleSection}>
                    <h3 className={styles.title}>{title}</h3>
                    {/* --- ИЗМЕНЕНИЕ 3: Теперь здесь будет название группы --- */}
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