import React, { useState, useEffect } from 'react';
import styles from './GroupsPage.module.css';
import Modal from '../components/Modal/Modal';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import API from '../api';
// --- 1. Remove StudentProfileCard import ---
// import StudentProfileCard from '../components/StudentProfileCard/StudentProfileCard';
// --- 2. Add context hook import ---
import { useStudentProfile } from '../context/StudentProfileContext';

const GroupsPage = () => {
    const [groups, setGroups] = useState([]);
    const [unassignedStudents, setUnassignedStudents] = useState([]);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [assignmentSelections, setAssignmentSelections] = useState({});
    
    // --- 3. Remove local state and use context ---
    // const [selectedStudentId, setSelectedStudentId] = useState(null);
    const { showProfile } = useStudentProfile();

    const fetchData = async () => {
        try {
            const [groupsRes, studentsRes] = await Promise.all([
                API.get('/api/groups'),
                API.get('/api/groups/unassigned')
            ]);
            setGroups(groupsRes.data);
            setUnassignedStudents(studentsRes.data);
        } catch (error) {
            console.error("Error loading data:", error);
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
            alert(error.response?.data?.message || 'Error creating group');
        }
    };

    const handleAssignStudent = async (studentId) => {
        const groupId = assignmentSelections[studentId];
        if (!groupId) {
            alert('Please select a group.');
            return;
        }
        try {
            await API.put(`/api/groups/${groupId}/assign`, { studentId });
            alert('Student assigned!');
            setAssignmentSelections(prev => ({...prev, [studentId]: ''}));
            fetchData();
        } catch (error) {
            alert(error.response?.data?.message || 'Error assigning student');
        }
    };

    const handleRemoveStudent = async (groupId, studentId) => {
        if (!window.confirm("Are you sure you want to remove this student from the group?")) {
            return;
        }
        try {
            await API.delete(`/api/groups/${groupId}/students/${studentId}`);
            fetchData();
        } catch (error) {
            alert(error.response?.data?.message || 'Error removing student');
        }
    };

    const handleDeleteGroup = async (groupId) => {
        if (!window.confirm("Are you sure you want to delete this group? All related lessons and evaluations will also be deleted! This action is irreversible.")) {
            return;
        }
        try {
            await API.delete(`/api/groups/${groupId}`);
            fetchData();
        } catch (error) {
            alert(error.response?.data?.message || 'Error deleting group');
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
                                                title="Delete group"
                                            >
                                                <FiTrash2 />
                                            </button>
                                        </div>
                                    </div>
                                    <ul className={styles.studentList}>
                                        {group.students && group.students.length > 0 ? group.students.map(student => (
                                            <li key={student._id} className={styles.studentListItem}>
                                                {/* --- 4. Modified handler --- */}
                                                <span 
                                                    className={styles.studentName} 
                                                    onClick={() => showProfile(student._id)}
                                                >
                                                    {student.name}
                                                </span>
                                                <button
                                                    className={styles.deleteStudentButton}
                                                    onClick={() => handleRemoveStudent(group._id, student._id)}
                                                    title="Remove student from group"
                                                >
                                                    <FiTrash2 />
                                                </button>
                                            </li>
                                        )) : (
                                            <li className={styles.noStudents}>No students in this group yet.</li>
                                        )}
                                    </ul>
                                </div>
                            )) : <p>You don’t have any groups yet.</p>}
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
                                            <option value="" disabled>Select a group</option>
                                            {groups.map(group => (
                                                <option key={group._id} value={group._id}>{group.name}</option>
                                            ))}
                                        </select>
                                        <button onClick={() => handleAssignStudent(student._id)}>Assign</button>
                                    </div>
                                </div>
                            )) : <p>No students awaiting assignment.</p>}
                        </div>
                    </section>
                </div>
            </div>

            <Modal isOpen={isCreateModalOpen} onRequestClose={() => setIsCreateModalOpen(false)} title="Create new group">
                <form onSubmit={handleCreateGroup} className={styles.modalForm}>
                    <div className={styles.formGroup}>
                        <label htmlFor="groupName">Group name</label>
                        <input
                            type="text"
                            id="groupName"
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            required
                            placeholder="For example, “Class 10-A”"
                        />
                    </div>
                    <div className={styles.formActions}>
                        <button type="button" className={styles.cancelButton} onClick={() => setIsCreateModalOpen(false)}>Cancel</button>
                        <button type="submit">Create</button>
                    </div>
                </form>
            </Modal>
            
            {/* --- 5. Remove modal window render from here --- */}
        </>
    );
};

export default GroupsPage;