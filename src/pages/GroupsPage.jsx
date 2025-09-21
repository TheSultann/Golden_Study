// src/pages/GroupsPage.jsx

import React, { useState, useEffect } from 'react';
import styles from './GroupsPage.module.css';
import Modal from '../components/Modal/Modal';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import API from '../api';

const GroupsPage = () => {
    const [groups, setGroups] = useState([]);
    const [unassignedStudents, setUnassignedStudents] = useState([]);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [assignmentSelections, setAssignmentSelections] = useState({});

    const fetchData = async () => {
        try {
            const [groupsRes, studentsRes] = await Promise.all([
                API.get('/api/groups'),
                API.get('/api/groups/unassigned')
            ]);
            setGroups(groupsRes.data);
            setUnassignedStudents(studentsRes.data);
        } catch (error) {
            console.error("Ошибка загрузки данных:", error);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        try {
            await API.post('/api/groups', { name: newGroupName });
            setIsCreateModalOpen(false);
            setNewGroupName('');
            fetchData();
        } catch (error) {
            alert(error.response?.data?.message || 'Ошибка создания группы');
        }
    };

    const handleAssignStudent = async (studentId) => {
        const groupId = assignmentSelections[studentId];
        if (!groupId) {
            alert('Пожалуйста, выберите группу.');
            return;
        }
        try {
            await API.put(`/api/groups/${groupId}/assign`, { studentId });
            alert('Ученик назначен!');
            setAssignmentSelections(prev => ({...prev, [studentId]: ''}));
            fetchData();
        } catch (error) {
            alert(error.response?.data?.message || 'Ошибка назначения');
        }
    };

    const handleRemoveStudent = async (groupId, studentId) => {
        if (!window.confirm("Вы уверены, что хотите удалить этого ученика из группы?")) {
            return;
        }
        try {
            await API.delete(`/api/groups/${groupId}/students/${studentId}`);
            fetchData();
        } catch (error) {
            alert(error.response?.data?.message || 'Ошибка удаления ученика');
        }
    };

    // --- ИЗМЕНЕННАЯ ФУНКЦИЯ УДАЛЕНИЯ ---
    const handleDeleteGroup = async (groupId) => {
        if (!window.confirm("Вы уверены, что хотите удалить эту группу? Все связанные уроки и оценки будут также удалены! Это действие необратимо.")) {
            return;
        }
        try {
            // Отправляем запрос на удаление
            await API.delete(`/api/groups/${groupId}`);
            
            // УДАЛЕНО: Оптимистичное обновление только одной части состояния
            // setGroups(currentGroups => currentGroups.filter(group => group._id !== groupId));
            
            // ДОБАВЛЕНО: Полное обновление данных с сервера для обеспечения консистентности
            // Эта функция обновит и список групп, и список нераспределенных студентов.
            fetchData();

        } catch (error) {
            alert(error.response?.data?.message || 'Ошибка удаления группы');
        }
    };

    return (
        <>
            <div className={styles.pageContainer}>
                <header className={styles.header}>
                    <h1>Group Management</h1>
                    <button className={styles.createButton} onClick={() => setIsCreateModalOpen(true)}>
                        <FiPlus /> Create Group
                    </button>
                </header>

                <div className={styles.content}>
                    <section className={styles.groupsSection}>
                        <h2 className={styles.sectionTitle}>My Groups</h2>
                        <div className={styles.groupList}>
                            {groups.length > 0 ? groups.map(group => (
                                <div key={group._id} className={styles.groupCard}>
                                    <div className={styles.cardHeader}>
                                        <h3>{group.name}</h3>
                                        <div className={styles.cardActions}>
                                            <span className={styles.studentCount}>{group.students.length} students</span>
                                            <button
                                                className={styles.deleteGroupButton}
                                                onClick={() => handleDeleteGroup(group._id)}
                                                title="Удалить группу"
                                            >
                                                <FiTrash2 />
                                            </button>
                                        </div>
                                    </div>
                                    <ul className={styles.studentList}>
                                        {group.students && group.students.length > 0 ? group.students.map(student => (
                                            <li key={student._id} className={styles.studentListItem}>
                                                <span>{student.name}</span>
                                                <button
                                                    className={styles.deleteStudentButton}
                                                    onClick={() => handleRemoveStudent(group._id, student._id)}
                                                    title="Удалить ученика из группы"
                                                >
                                                    <FiTrash2 />
                                                </button>
                                            </li>
                                        )) : (
                                            <li className={styles.noStudents}>В этой группе пока нет учеников.</li>
                                        )}
                                    </ul>
                                </div>
                            )) : <p>У вас еще нет созданных групп.</p>}
                        </div>
                    </section>

                    <section className={styles.studentsSection}>
                        <h2 className={styles.sectionTitle}>Awaiting Assignment</h2>
                        <div className={styles.unassignedList}>
                            {unassignedStudents.length > 0 ? unassignedStudents.map(student => (
                                <div key={student._id} className={styles.studentItem}>
                                    <div className={styles.studentInfo}>
                                        <strong>{student.name}</strong>
                                        <span>{student.email}</span>
                                    </div>
                                    <div className={styles.assignControls}>
                                        <select
                                            value={assignmentSelections[student._id] || ''}
                                            onChange={(e) => setAssignmentSelections({...assignmentSelections, [student._id]: e.target.value})}
                                        >
                                            <option value="" disabled>Выберите группу</option>
                                            {groups.map(group => (
                                                <option key={group._id} value={group._id}>{group.name}</option>
                                            ))}
                                        </select>
                                        <button onClick={() => handleAssignStudent(student._id)}>Назначить</button>
                                    </div>
                                </div>
                            )) : <p>No students awaiting assignment.</p>}
                        </div>
                    </section>
                </div>
            </div>

            <Modal isOpen={isCreateModalOpen} onRequestClose={() => setIsCreateModalOpen(false)} title="Создать новую группу">
                <form onSubmit={handleCreateGroup} className={styles.modalForm}>
                    <div className={styles.formGroup}>
                        <label htmlFor="groupName">Название группы</label>
                        <input
                            type="text"
                            id="groupName"
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            required
                            placeholder="Например, '10-А класс'"
                        />
                    </div>
                    <div className={styles.formActions}>
                        <button type="button" className={styles.cancelButton} onClick={() => setIsCreateModalOpen(false)}>Отмена</button>
                        <button type="submit">Создать</button>
                    </div>
                </form>
            </Modal>
        </>
    );
};

export default GroupsPage;