// src/components/Dashboard/StudentDashboard/StudentDashboard.jsx (ИЗМЕНЕННЫЙ)

import React, { useState, useEffect } from 'react';
import styles from './StudentDashboard.module.css';
import { FiClipboard, FiStar, FiMessageSquare, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import CourseCard from '../../CourseCard/CourseCard.jsx';
import Modal from '../../Modal/Modal';
import StudentStatistics from '../Statistics/StudentStatistics';
import API from '../../../api'; // <-- ИМПОРТИРУЕМ НАШ ФАЙЛ

const StudentDashboard = () => {
    const userName = localStorage.getItem('userName') || 'Student';
    const token = localStorage.getItem('userToken'); // Оставим для проверки, есть ли пользователь

    const [lessons, setLessons] = useState([]);
    const [isLoadingLessons, setIsLoadingLessons] = useState(true);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedLesson, setSelectedLesson] = useState(null);
    const [evaluation, setEvaluation] = useState(null);
    const [isLoadingEvaluation, setIsLoadingEvaluation] = useState(false);
    const [stats, setStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(true);
    const [statsError, setStatsError] = useState('');

    useEffect(() => {
        // --- ИЗМЕНЕНИЕ 1 ---
        const fetchLessons = async () => {
            if (!token) { setIsLoadingLessons(false); return; }
            try {
                const response = await API.get('/api/lessons');
                setLessons(response.data);
            } catch (error) { console.error("Ошибка загрузки уроков:", error); } 
            finally { setIsLoadingLessons(false); }
        };
        // --- ИЗМЕНЕНИЕ 2 ---
        const fetchStats = async () => {
            if (!token) { setStatsError('Нет авторизации'); setStatsLoading(false); return; }
            try {
                const res = await API.get('/api/stats/student');
                setStats(res.data);
            } catch (err) { setStatsError(err.response?.data?.message || err.message); } 
            finally { setStatsLoading(false); }
        };
        
        fetchLessons();
        fetchStats();
    }, [token]);
    
    // --- ИЗМЕНЕНИЕ 3 ---
    const handleOpenDetailModal = async (lesson) => {
        setSelectedLesson(lesson);
        setIsDetailModalOpen(true);
        setIsLoadingEvaluation(true);
        setEvaluation(null);
        try {
            const response = await API.get(`/api/evaluations/student/${lesson._id}`);
            setEvaluation(response.data);
        } catch (error) {
            // axios не выдаст ошибку на 404, а зайдет в .catch
            if (error.response?.status !== 404) {
                 console.error('Ошибка загрузки оценки:', error);
            }
        } finally {
            setIsLoadingEvaluation(false);
        }
    };
    
    const handleCloseDetailModal = () => {
        setIsDetailModalOpen(false);
        setSelectedLesson(null);
        setEvaluation(null);
    };

    const averageGrade = stats?.rating?.myRank?.averageGrade;

    return (
        <>
            <main className={styles.dashboard}>
                <header className={styles.header}>
                    <h1 className={styles.title}>
                        Hello, <span>{userName}!</span> 👋
                    </h1>
                    <p className={styles.subtitle}>Let's learn something new today!</p>
                </header>

                <div className={styles.promoBanner}>
                    <div className={styles.promoContent}>
                        {averageGrade !== undefined ? (<h2>Your average score is: {averageGrade}%</h2>) : (<h2>Complete your first lesson to see your score!</h2>)}
                        <div className={styles.goalProgressContainer}><div className={styles.goalProgressBar} style={{width: `${averageGrade || 0}%`}}></div></div>
                    </div>
                    <div className={styles.promoIcon}>🎯</div>
                </div>
                <section className={styles.section}>
                    <div className={styles.sectionHeader}><h3>My Lessons</h3><a href="#">All Lessons</a></div>
                    <div className={styles.coursesGrid}>
                        {isLoadingLessons ? (<p>Loading lessons...</p>) : lessons.length > 0 ? (lessons.map(lesson => (<CourseCard key={lesson._id} lesson={lesson} onClick={() => handleOpenDetailModal(lesson)} />))) : (<p>Вам еще не назначили уроков.</p>)}
                    </div>
                </section>
                <section className={styles.section}>
                    <div className={styles.sectionHeader}><h3>My Progress & Rating</h3></div>
                    <StudentStatistics stats={stats} loading={statsLoading} error={statsError} />
                </section>
            </main>

            <Modal isOpen={isDetailModalOpen} onRequestClose={handleCloseDetailModal} title={`Урок: ${selectedLesson?.title || ''}`}>
                {selectedLesson && (
                    <div className={styles.studentModalContainer}>
                        <div className={styles.assignmentsSection}>
                            <h4><FiClipboard /> Задания к уроку:</h4>
                            {selectedLesson.assignments && selectedLesson.assignments.length > 0 ? (
                                <div className={styles.assignmentList}>
                                    {selectedLesson.assignments.map(assign => {
                                        const isCompleted = evaluation?.skills?.includes(assign._id);
                                        return (
                                            <div key={assign._id} className={styles.assignmentItem}>
                                                <div className={styles.assignmentDetails}>
                                                    <strong>{assign.title}</strong>
                                                    <p>{assign.description}</p>
                                                </div>
                                                {evaluation && (
                                                    isCompleted ? (
                                                        <FiCheckCircle className={styles.completedIcon} title="Выполнено" />
                                                    ) : (
                                                        <FiXCircle className={styles.notCompletedIcon} title="Не выполнено" />
                                                    )
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p>К этому уроку нет заданий.</p>
                            )}
                        </div>
                        
                        <hr className={styles.divider} />

                        <div>
                            <h4><FiStar /> Ваша оценка:</h4>
                            {isLoadingEvaluation ? (
                                <p>Загрузка оценки...</p>
                            ) : evaluation ? (
                                <div className={styles.evaluationBox}>
                                    <div className={styles.grade}>
                                        <strong>Оценка:</strong> {evaluation.grade}%
                                    </div>
                                    {evaluation.feedback && (
                                       <div className={styles.feedbackResult}>
                                           <h4><FiMessageSquare/> Комментарий от {evaluation.teacher?.name || 'учителя'}:</h4>
                                           <p>{evaluation.feedback}</p>
                                       </div>
                                    )}
                                </div>
                            ) : (
                                <p>Оценка еще не выставлена.</p>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
};

export default StudentDashboard;