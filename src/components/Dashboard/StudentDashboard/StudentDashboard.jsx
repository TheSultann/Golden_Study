import React, { useState, useEffect } from 'react';
import styles from './StudentDashboard.module.css';
import { FiClipboard, FiStar, FiMessageSquare, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import CourseCard from '../../CourseCard/CourseCard.jsx';
import Modal from '../../Modal/Modal';
import StudentStatistics from '../Statistics/StudentStatistics';
import API from '../../../api';

const StudentDashboard = () => {
    const userName = localStorage.getItem('userName') || 'Student';
    const token = localStorage.getItem('userToken');

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
        const fetchLessons = async () => {
            if (!token) { setIsLoadingLessons(false); return; }
            try {
                const response = await API.get('/api/lessons');
                setLessons(response.data);
            } catch (error) { console.error("Error loading lessons:", error); } 
            finally { setIsLoadingLessons(false); }
        };
        const fetchStats = async () => {
            if (!token) { setStatsError('No authorization'); setStatsLoading(false); return; }
            try {
                const res = await API.get('/api/stats/student');
                setStats(res.data);
            } catch (err) { setStatsError(err.response?.data?.message || err.message); } 
            finally { setStatsLoading(false); }
        };
        
        fetchLessons();
        fetchStats();
    }, [token]);
    
    // --- CHANGE HERE: Function now makes two requests ---
    const handleOpenDetailModal = async (lesson) => {
        setIsDetailModalOpen(true);
        setIsLoadingEvaluation(true); // Use this state for general loading in modal
        setSelectedLesson(null);      // Reset old data
        setEvaluation(null);

        try {
            // Execute both requests in parallel for efficiency
            const [lessonResponse, evaluationResponse] = await Promise.all([
                API.get(`/api/lessons/${lesson._id}`), // 1. Request for full lesson information
                API.get(`/api/evaluations/student/${lesson._id}`).catch(err => {
                    // If evaluation not found (404), it's not an error, just return null
                    if (err.response?.status === 404) return null;
                    throw err; // Other errors are rethrown
                })
            ]);

            // Save results to state
            setSelectedLesson(lessonResponse.data);
            if (evaluationResponse) {
                setEvaluation(evaluationResponse.data);
            }
            
        } catch (error) {
            console.error('Error loading lesson details:', error);
            // Can add error handling, e.g., close modal
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
                        {averageGrade !== undefined ? (<h2>Your average score is: {averageGrade.toFixed(1)}%</h2>) : (<h2>Complete your first lesson to see your score!</h2>)}
                        <div className={styles.goalProgressContainer}><div className={styles.goalProgressBar} style={{width: `${averageGrade || 0}%`}}></div></div>
                    </div>
                    <div className={styles.promoIcon}>🎯</div>
                </div>
                <section className={styles.section}>
                    <div className={styles.sectionHeader}><h3>My Lessons</h3><a href="#">All Lessons</a></div>
                    <div className={styles.coursesGrid}>
                        {isLoadingLessons ? (<p>Loading lessons...</p>) : lessons.length > 0 ? (lessons.map(lesson => (<CourseCard key={lesson._id} lesson={lesson} onClick={() => handleOpenDetailModal(lesson)} />))) : (<p>No lessons assigned to you yet.</p>)}
                    </div>
                </section>
                <section className={styles.section}>
                    <div className={styles.sectionHeader}><h3>My Progress & Rating</h3></div>
                    <StudentStatistics stats={stats} loading={statsLoading} error={statsError} />
                </section>
            </main>

            <Modal isOpen={isDetailModalOpen} onRequestClose={handleCloseDetailModal} title={`Lesson: ${selectedLesson?.title || ''}`}>
                {/* --- CHANGE HERE: Added loading check to avoid errors --- */}
                {isLoadingEvaluation ? (<p>Loading lesson data...</p>) : selectedLesson && (
                    <div className={styles.studentModalContainer}>
                        <div className={styles.assignmentsSection}>
                            <h4><FiClipboard /> Lesson assignments:</h4>
                            {/* This logic will now work correctly, as selectedLesson contains all assignments */}
                            {selectedLesson.assignments && selectedLesson.assignments.length > 0 ? (
                                <div className={styles.assignmentList}>
                                    {selectedLesson.assignments.map(assign => {
                                        // evaluation?.skills - array of completed assignment IDs
                                        const isCompleted = evaluation?.skills?.includes(assign._id);
                                        return (
                                            <div key={assign._id} className={styles.assignmentItem}>
                                                <div className={styles.assignmentDetails}>
                                                    <strong>{assign.title}</strong>
                                                    <p>{assign.description}</p>
                                                </div>
                                                {/* Icon is shown only if there is an evaluation */}
                                                {evaluation && (
                                                    isCompleted ? (
                                                        <FiCheckCircle className={styles.completedIcon} title="Completed" />
                                                    ) : (
                                                        <FiXCircle className={styles.notCompletedIcon} title="Not completed" />
                                                    )
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p>No assignments for this lesson.</p>
                            )}
                        </div>
                        
                        <hr className={styles.divider} />

                        <div>
                            <h4><FiStar /> Your grade:</h4>
                            {evaluation ? (
                                <div className={styles.evaluationBox}>
                                    <div className={styles.grade}>
                                        <strong>Grade:</strong> {evaluation.grade}%
                                    </div>
                                    {evaluation.feedback && (
                                       <div className={styles.feedbackResult}>
                                           <h4><FiMessageSquare/> Comment from {evaluation.teacher?.name || 'teacher'}:</h4>
                                           <p>{evaluation.feedback}</p>
                                       </div>
                                    )}
                                </div>
                            ) : (
                                <p>Grade not assigned yet.</p>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
};

export default StudentDashboard;