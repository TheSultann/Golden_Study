import React, { useState, useEffect, useMemo } from 'react';
import styles from './TeacherDashboard.module.css';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import Modal from '../../Modal/Modal';
import EvaluationRow from './EvaluationRow';
import AssignmentItem from './AssignmentItem';
import GroupStatistics from '../Statistics/GroupStatistics';
import API from '../../../api';

const TeacherDashboard = () => {
    const teacherName = localStorage.getItem('userName') || 'Teacher';
    const token = localStorage.getItem('userToken');

    const [lessons, setLessons] = useState([]);
    const [groups, setGroups] = useState([]);
    const [evaluationData, setEvaluationData] = useState([]);
    const [isLoadingEvaluations, setIsLoadingEvaluations] = useState(false);
    const [isDetailLoading, setIsDetailLoading] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newLessonTitle, setNewLessonTitle] = useState('');
    const [newLessonDueDate, setNewLessonDueDate] = useState('');
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedLesson, setSelectedLesson] = useState(null);
    const [newAssignmentTitle, setNewAssignmentTitle] = useState('');
    const [newAssignmentDescription, setNewAssignmentDescription] = useState('');
    const [activeTab, setActiveTab] = useState('assignments');
    const [mainTab, setMainTab] = useState('lessons');
    
    // --- 1. НОВЫЙ STATE ДЛЯ МОБИЛЬНОЙ ВЕРСИИ ---
    const [activeLessonId, setActiveLessonId] = useState(null);

    const fetchData = async () => {
        try {
            const [lessonsRes, groupsRes] = await Promise.all([
                API.get('/api/lessons'),
                API.get('/api/groups')
            ]);
            setLessons(lessonsRes.data);
            setGroups(groupsRes.data);
        } catch (error) { console.error("Ошибка загрузки данных:", error); }
    };

    useEffect(() => {
        if (token) fetchData();
    }, [token]);

    const groupedLessons = useMemo(() => {
        if (!lessons || lessons.length === 0) return {};
        return lessons.reduce((acc, lesson) => {
            const groupName = lesson.group?.name || 'Без группы';
            if (!acc[groupName]) acc[groupName] = [];
            acc[groupName].push(lesson);
            return acc;
        }, {});
    }, [lessons]);

    const handleOpenCreateModal = () => {
        setNewLessonTitle('');
        setNewLessonDueDate('');
        if (groups.length > 0) setSelectedGroupId(groups[0]._id);
        else setSelectedGroupId('');
        setIsCreateModalOpen(true);
    };

    const handleCreateLesson = async (event) => {
        event.preventDefault();
        if (!selectedGroupId) {
            alert('Пожалуйста, выберите группу.');
            return;
        }
        try {
            await API.post('/api/lessons', {
                title: newLessonTitle,
                dueDate: newLessonDueDate,
                groupId: selectedGroupId
            });
            alert('Урок создан!');
            setIsCreateModalOpen(false);
            fetchData();
        } catch (error) {
            alert(error.response?.data?.message || 'Ошибка создания урока');
        }
    };

    const handleDeleteLesson = async (lessonId) => {
        if (window.confirm('Вы уверены, что хотите удалить этот урок? Все оценки учеников сохранятся для статистики.')) {
            try {
                await API.delete(`/api/lessons/${lessonId}`);
                alert('Урок удален.');
                fetchData();
            } catch (error) {
                alert(error.response?.data?.message || 'Ошибка при удалении урока');
            }
        }
    };

    const handleOpenDetailModal = async (lesson) => {
        setIsDetailModalOpen(true);
        setIsDetailLoading(true);
        setActiveTab('assignments');
        setSelectedLesson(null);
        try {
            const response = await API.get(`/api/lessons/${lesson._id}`);
            setSelectedLesson(response.data);
        } catch (error) {
            console.error("Ошибка загрузки деталей урока:", error);
            alert("Не удалось загрузить детали урока.");
            setIsDetailModalOpen(false);
        } finally {
            setIsDetailLoading(false);
        }
    };

    const handleCloseDetailModal = () => {
        setIsDetailModalOpen(false);
        setSelectedLesson(null);
        setEvaluationData([]);
        setNewAssignmentTitle('');
        setNewAssignmentDescription('');
        fetchData();
    };

    const handleAddAssignment = async (e) => {
        e.preventDefault();
        if (!selectedLesson) return;
        try {
            const res = await API.post(`/api/lessons/${selectedLesson._id}/assignments`, {
                title: newAssignmentTitle,
                description: newAssignmentDescription
            });
            setSelectedLesson(res.data);
            setNewAssignmentTitle('');
            setNewAssignmentDescription('');
            alert('Задание добавлено!');
        } catch (error) {
            alert(error.response?.data?.message || 'Ошибка добавления задания');
        }
    };

    const handleDeleteAssignment = async (assignmentId) => {
        if (!selectedLesson || !window.confirm('Вы уверены?')) return;
        try {
            const res = await API.delete(`/api/lessons/${selectedLesson._id}/assignments/${assignmentId}`);
            setSelectedLesson(res.data);
            alert('Задание удалено.');
        } catch (error) {
            alert(error.response?.data?.message || 'Ошибка удаления');
        }
    };

    useEffect(() => {
        if (activeTab === 'evaluations' && selectedLesson?._id) {
            const fetchEvaluations = async () => {
                setIsLoadingEvaluations(true);
                try {
                    const res = await API.get(`/api/evaluations/${selectedLesson._id}`);
                    setEvaluationData(res.data);
                } catch (error) {
                    console.error("Ошибка загрузки оценок:", error);
                } finally {
                    setIsLoadingEvaluations(false);
                }
            };
            fetchEvaluations();
        }
    }, [activeTab, selectedLesson]);

    const handleUpdateEvaluationInState = (studentId, savedEvaluation) => { setEvaluationData(prev => prev.map(data => data.student._id === studentId ? { ...data, evaluation: savedEvaluation, isNew: false } : data)); };

    // --- 2. НОВАЯ ФУНКЦИЯ ДЛЯ ОБРАБОТКИ КЛИКА НА МОБИЛЬНЫХ ---
    const handleLessonRowClick = (lessonId) => {
        // Если кликаем на уже активный урок, деактивируем его. Иначе - активируем.
        setActiveLessonId(prevId => (prevId === lessonId ? null : lessonId));
    };

    return (
        <>
            <div className={styles.dashboard}>
                <header className={styles.header}>
                    <div><h3>Hello, {teacherName}!</h3><p>Here are your lessons and students’ performance.</p></div>
                    <button className={styles.createButton} onClick={handleOpenCreateModal}><FiPlus />Create lesson</button>
                </header>
                <div className={styles.mainTabContainer}>
                    <button onClick={() => setMainTab('lessons')} className={mainTab === 'lessons' ? styles.activeMainTab : styles.mainTab}>Lessons</button>
                    <button onClick={() => setMainTab('statistics')} className={mainTab === 'statistics' ? styles.activeMainTab : styles.mainTab}>📊 Group statistics</button>
                </div>
                {mainTab === 'lessons' && (
                    <div className={styles.lessonList}>
                        <div className={`${styles.lessonRow} ${styles.headerRow}`}>
                            <span>Lesson</span>
                            <span>Created in</span>
                            <span>Actions</span>
                        </div>
                        
                        {Object.keys(groupedLessons).length > 0 ? (
                            Object.entries(groupedLessons).map(([groupName, lessonsInGroup]) => (
                                <React.Fragment key={groupName}>
                                    <h4 className={styles.groupHeader}>{groupName}</h4>
                                    {lessonsInGroup.map(lesson => (
                                        // --- 3. ИЗМЕНЯЕМ РАЗМЕТКУ СТРОКИ УРОКА ---
                                        <div 
                                            className={`${styles.lessonRow} ${activeLessonId === lesson._id ? styles.active : ''}`} 
                                            key={lesson._id}
                                            onClick={() => handleLessonRowClick(lesson._id)} // Добавляем обработчик клика
                                        >
                                            <span className={styles.lessonTitle}>{lesson.title}</span>
                                            <span className={styles.lessonDate}>
                                                {new Date(lesson.createdAt).toLocaleDateString('ru-RU', {
                                                    day: '2-digit', month: '2-digit', year: 'numeric'
                                                })}
                                            </span>
                                            <div className={styles.actionsContainer}>
                                                <button onClick={(e) => { e.stopPropagation(); handleOpenDetailModal(lesson); }} className={styles.gradeButton}>Управлять</button>
                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteLesson(lesson._id); }} className={styles.lessonDeleteButton} title="Удалить урок">
                                                    <FiTrash2 />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </React.Fragment>
                            ))
                        ) : (
                            <p className={styles.noLessons}>No lessons yet. Create the first one!</p>
                        )}
                    </div>
                )}
                {mainTab === 'statistics' && <GroupStatistics groups={groups} />}
            </div>

            {/* Модальные окна остаются без изменений */}
            <Modal isOpen={isCreateModalOpen} onRequestClose={() => setIsCreateModalOpen(false)} title="Create new lesson" modalClassName={styles.defaultModal}>
                 <form onSubmit={handleCreateLesson} className={styles.createLessonForm}>
                    <div className={styles.formGroup}><label htmlFor="groupSelect">Group</label><select id="groupSelect" value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)} required><option value="" disabled>Select group</option>{groups.map(group => (<option key={group._id} value={group._id}>{group.name}</option>))}</select></div>
                    <div className={styles.formGroup}><label htmlFor="lessonTitle">Lesson title</label><input type="text" id="lessonTitle" value={newLessonTitle} onChange={(e) => setNewLessonTitle(e.target.value)} required /></div>
                    <div className={styles.formGroup}><label htmlFor="dueDate">Due date</label><input type="date" id="dueDate" value={newLessonDueDate} onChange={(e) => setNewLessonDueDate(e.target.value)} /></div>
                    <div className={styles.formActions}><button type="button" className={styles.cancelButton} onClick={() => setIsCreateModalOpen(false)}>Cancel</button><button type="submit" className={styles.submitButton}>Create</button></div>
                </form>
            </Modal>
            
            <Modal 
                isOpen={isDetailModalOpen} 
                onRequestClose={handleCloseDetailModal} 
                title={`Урок: ${selectedLesson?.title || 'Загрузка...'}`}
                modalClassName={activeTab === 'evaluations' ? styles.wideModal : styles.defaultModal}
            >
                {isDetailLoading ? (<p>Загрузка данных урока...</p>) : selectedLesson && (
                    <>
                        <div className={styles.tabContainer}>
                            <button onClick={() => setActiveTab('assignments')} className={activeTab === 'assignments' ? styles.activeTab : styles.tab}>Задания</button>
                            <button onClick={() => setActiveTab('evaluations')} className={activeTab === 'evaluations' ? styles.activeTab : styles.tab}>Оценки</button>
                        </div>
                        <div className={styles.tabContent}>
                            {activeTab === 'assignments' && (
                                <div>
                                    <h4>Существующие задания</h4>
                                    <div className={styles.assignmentList}>
                                        {selectedLesson?.assignments?.length > 0 ? (
                                            selectedLesson.assignments.map((assign) => (
                                                <AssignmentItem key={assign._id} assignment={assign} lessonId={selectedLesson._id} onUpdate={setSelectedLesson} onDelete={() => handleDeleteAssignment(assign._id)} />
                                            ))
                                        ) : (<p>Заданий пока нет.</p>)}
                                    </div>
                                    <hr className={styles.divider}/>
                                    <h4>Добавить новое задание</h4>
                                    <form onSubmit={handleAddAssignment} className={styles.addAssignmentForm}>
                                        <div className={styles.formGroup}><label>Название</label><input type="text" value={newAssignmentTitle} onChange={(e) => setNewAssignmentTitle(e.target.value)} required /></div>
                                        <div className={styles.formGroup}><label>Описание</label><textarea value={newAssignmentDescription} onChange={(e) => setNewAssignmentDescription(e.target.value)}></textarea></div>
                                        <div className={styles.formActions}><button type="submit" className={styles.submitButton}>Добавить</button></div>
                                    </form>
                                </div>
                            )}

                            {activeTab === 'evaluations' && (
                                <div>
                                    {!selectedLesson?.assignments?.length ? (<p>Сначала добавьте задания...</p>) : (
                                        <>
                                            <div className={`${styles.evaluationRow} ${styles.evaluationHeader}`}><span>Ученик</span><span>Оценка (%)</span><span>Выполненные задания</span><span>Действие</span></div>
                                            <div className={styles.evaluationContainer}>
                                                {isLoadingEvaluations ? <p>Загрузка...</p> : (evaluationData.map(data => (<EvaluationRow key={data.student._id} studentData={data} lessonId={selectedLesson._id} onSave={handleUpdateEvaluationInState} />)))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </Modal>
        </>
    );
};

export default TeacherDashboard;