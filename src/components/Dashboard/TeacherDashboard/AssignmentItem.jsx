import React, { useState } from 'react';
import styles from './TeacherDashboard.module.css';
import { FiEdit, FiTrash, FiSave, FiX } from 'react-icons/fi';

const AssignmentItem = ({ assignment, lessonId, token, onUpdate, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(assignment.title);
    const [description, setDescription] = useState(assignment.description);

    const handleEdit = async () => {
        try {
            const res = await fetch(`/api/lessons/${lessonId}/assignments/${assignment._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ title, description })
            });
            const updatedLesson = await res.json();
            if (res.ok) {
                onUpdate(updatedLesson); 
                setIsEditing(false);
                alert('Задание обновлено.');
            } else {
                throw new Error(updatedLesson.message);
            }
        } catch (error) {
            alert(error.message);
        }
    };

    const handleCancel = () => {
        setTitle(assignment.title);
        setDescription(assignment.description);
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <div className={styles.assignmentItem}>
                <div className={styles.assignmentContent}>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className={styles.editInput}
                    />
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className={styles.editInput}
                        rows="2"
                    ></textarea>
                </div>
                <div className={styles.actionButtons}>
                    {/* --- ГЛАВНОЕ ИСПРАВЛЕНИЕ ЗДЕСЬ --- */}
                    <button onClick={handleEdit} className={`${styles.actionButton} ${styles.saveEditButton}`}><FiSave /></button>
                    <button onClick={handleCancel} className={`${styles.actionButton} ${styles.cancelEditButton}`}><FiX /></button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.assignmentItem}>
            <div className={styles.assignmentContent}>
                <strong>{assignment.title}</strong>
                <p>{assignment.description}</p>
            </div>
            <div className={styles.actionButtons}>
                <button onClick={() => setIsEditing(true)} className={styles.actionButton}><FiEdit /></button>
                <button onClick={() => onDelete(assignment._id)} className={styles.deleteButton}><FiTrash /></button>
            </div>
        </div>
    );
};

export default AssignmentItem;