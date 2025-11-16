import React, { useState, useEffect, useMemo } from 'react';
import styles from './TeacherDashboard.module.css';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import Modal from '../../Modal/Modal';
import EvaluationRow from './EvaluationRow';
import AssignmentItem from './AssignmentItem';
import GroupStatistics from '../Statistics/GroupStatistics';
import API from '../../../api';
import AttendanceTab from './AttendanceTab'; // <-- 1. ИМПОРТ НОВОГО КОМПОНЕНТА

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
    const [activeLessonId, setActiveLessonId] = useState(null);

    const fetchData = async () => {
        try {
            const [lessonsRes, groupsRes] = await Promise.all([
                API.get('/api/lessons'),
                API.get('/api/groups')
            ]);
            setLessons(lessonsRes.data);
            setGroups(groupsRes.data);
        } catch (error) { console.error("Data loading error:", error); }
    };

    useEffect(() => {
        if (token) fetchData();
    }, [token]);

    const groupedLessons = useMemo(() => {
        if (!lessons || lessons.length === 0) return {};
        return lessons.reduce((acc, lesson) => {
            const groupName = lesson.group?.name || 'No group';
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
            alert('Please select a group.');
            return;
        }
        try {
            await API.post('/api/lessons', {
                title: newLessonTitle,
                dueDate: newLessonDueDate,
                groupId: selectedGroupId
            });
            alert('Lesson created!');
            setIsCreateModalOpen(false);
            fetchData();
        } catch (error) {
            alert(error.response?.data?.message || 'Lesson creation failed');
        }
    };

    const handleDeleteLesson = async (lessonId) => {
        if (window.confirm('Are you sure you want to delete this lesson? All student grades will remain for statistics.')) {
            try {
                await API.delete(`/api/lessons/${lessonId}`);
                alert('Lesson deleted.');
                fetchData();
            } catch (error) {
                alert(error.response?.data?.message || 'Lesson deletion error');
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
            console.error("Lesson details loading error:", error);
            alert("Failed to load lesson details.");
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
            alert('Assignment added!');
        } catch (error) {
            alert(error.response?.data?.message || 'Assignment creation error');
        }
    };

    const handleDeleteAssignment = async (assignmentId) => {
        if (!selectedLesson || !window.confirm('Are you sure?')) return;
        try {
            const res = await API.delete(`/api/lessons/${selectedLesson._id}/assignments/${assignmentId}`);
            setSelectedLesson(res.data);
            alert('Assignment deleted.');
        } catch (error) {
            alert(error.response?.data?.message || 'Deletion error');
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
                    console.error("Loading lesson data...", error);
                } finally {
                    setIsLoadingEvaluations(false);
                }
            };
            fetchEvaluations();
        }
    }, [activeTab, selectedLesson]);

    const handleUpdateEvaluationInState = (studentId, savedEvaluation) => { setEvaluationData(prev => prev.map(data => data.student._id === studentId ? { ...data, evaluation: savedEvaluation, isNew: false } : data)); };

    const handleLessonRowClick = (lessonId) => {
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
                                        <div 
                                            className={`${styles.lessonRow} ${activeLessonId === lesson._id ? styles.active : ''}`} 
                                            key={lesson._id}
                                            onClick={() => handleLessonRowClick(lesson._id)}
                                        >
                                            <span className={styles.lessonTitle}>{lesson.title}</span>
                                            <span className={styles.lessonDate}>
                                                {new Date(lesson.createdAt).toLocaleDateString('ru-RU', {
                                                    day: '2-digit', month: '2-digit', year: 'numeric'
                                                })}
                                            </span>
                                            <div className={styles.actionsContainer}>
                                                <button onClick={(e) => { e.stopPropagation(); handleOpenDetailModal(lesson); }} className={styles.gradeButton}>Manage</button>
                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteLesson(lesson._id); }} className={styles.lessonDeleteButton} title="Delete lesson">
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
                title={`Lesson: ${selectedLesson?.title || 'Loading...'}`}
                modalClassName={activeTab === 'evaluations' || activeTab === 'attendance' ? styles.wideModal : styles.defaultModal} // <-- 2. ИЗМЕНЕНО
            >
                {isDetailLoading ? (<p>Загрузка данных урока...</p>) : selectedLesson && (
                    <>
                        {/* --- 3. ИЗМЕНЕН БЛОК Вкладок --- */}
                        <div className={styles.tabContainer}>
                            <button onClick={() => setActiveTab('assignments')} className={activeTab === 'assignments' ? styles.activeTab : styles.tab}>Assignments</button>
                            <button onClick={() => setActiveTab('attendance')} className={activeTab === 'attendance' ? styles.activeTab : styles.tab}>Attendance</button>
                            <button onClick={() => setActiveTab('evaluations')} className={activeTab === 'evaluations' ? styles.activeTab : styles.tab}>Grades</button>
                        </div>
                        <div className={styles.tabContent}>
                            {activeTab === 'assignments' && (
                                <div>
                                    <h4>Existing assignments</h4>
                                    <div className={styles.assignmentList}>
                                        {selectedLesson?.assignments?.length > 0 ? (
                                            selectedLesson.assignments.map((assign) => (
                                                <AssignmentItem key={assign._id} assignment={assign} lessonId={selectedLesson._id} onUpdate={setSelectedLesson} onDelete={() => handleDeleteAssignment(assign._id)} />
                                            ))
                                        ) : (<p>No assignments yet.</p>)}
                                    </div>
                                    <hr className={styles.divider}/>
                                    <h4>Create new assignment</h4>
                                    <form onSubmit={handleAddAssignment} className={styles.addAssignmentForm}>
                                        <div className={styles.formGroup}><label>Title</label><input type="text" value={newAssignmentTitle} onChange={(e) => setNewAssignmentTitle(e.target.value)} required /></div>
                                        <div className={styles.formGroup}><label>Description</label><textarea value={newAssignmentDescription} onChange={(e) => setNewAssignmentDescription(e.target.value)}></textarea></div>
                                        <div className={styles.formActions}><button type="submit" className={styles.submitButton}>Add</button></div>
                                    </form>
                                </div>
                            )}

                            {/* --- 4. ДОБАВЛЕНА НОВАЯ Вкладка --- */}
                            {activeTab === 'attendance' && (
                                <AttendanceTab lessonId={selectedLesson._id} />
                            )}

                            {activeTab === 'evaluations' && (
                                <div>
                                    {!selectedLesson?.assignments?.length ? (<p>Please add assignments first...</p>) : (
                                        <>
                                            <div className={`${styles.evaluationRow} ${styles.evaluationHeader}`}><span>Student</span><span>Grade (%)</span><span>Completed assignments</span><span>Action</span></div>
                                            <div className={styles.evaluationContainer}>
                                                {isLoadingEvaluations ? <p>Action...</p> : (evaluationData.map(data => (<EvaluationRow key={data.student._id} studentData={data} lessonId={selectedLesson._id} onSave={handleUpdateEvaluationInState} />)))}
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