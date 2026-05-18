import React, { useState } from 'react';
import styles from './TeacherDashboard.module.css';
import API from '../../../api';
// --- 1. Import hook for context access ---
import { useStudentProfile } from '../../../context/StudentProfileContext';

const EvaluationRow = ({ studentData, lessonId, onSave }) => {
    const [evaluation, setEvaluation] = useState(studentData.evaluation);
    // --- 2. Get function to call modal window ---
    const { showProfile } = useStudentProfile();

    const handleGradeChange = (e) => {
        setEvaluation(prev => ({ ...prev, grade: e.target.value }));
    };

    const handleSkillChange = (assignmentId) => {
        const updatedSkills = evaluation.skills.map(skill => 
            skill.assignmentId === assignmentId 
                ? { ...skill, completed: !skill.completed } 
                : skill
        );
        setEvaluation(prev => ({ ...prev, skills: updatedSkills }));
    };

    const handleSaveClick = async () => {
        try {
            const res = await API.post('/api/evaluations', {
                lessonId,
                studentId: studentData.student._id,
                grade: Number(evaluation.grade) || 0,
                skills: evaluation.skills,
            });

            const savedEvaluation = res.data;
            alert(`Grade for ${studentData.student.name} saved.`);
            onSave(studentData.student._id, savedEvaluation);
            
        } catch (error) {
            console.error("Error:", error);
            alert(error.response?.data?.message || 'Error saving');
        }
    };
    
    return (
        <div className={styles.evaluationRow}>
            <div className={styles.evaluationCell}>
                <span className={styles.mobileLabel}>Student</span>
                {/* --- 3. Make student name clickable --- */}
                <span
                    className={`${styles.studentNameCell} ${styles.clickableStudentName}`}
                    onClick={() => showProfile(studentData.student._id)}
                    title={`View profile of ${studentData.student.name}`}
                >
                    {studentData.student.name}
                </span>
                {/* --- END OF CHANGES --- */}
            </div>

            <div className={styles.evaluationCell}>
                <span className={styles.mobileLabel}>Grade (%)</span>
                <input
                    type="number"
                    min="0"
                    max="100"
                    value={evaluation.grade}
                    onChange={handleGradeChange}
                    placeholder="%"
                />
            </div>

            <div className={`${styles.evaluationCell} ${styles.skillsCell}`}>
                <span className={styles.mobileLabel}>Completed assignments</span>
                {evaluation.skills.map(skill => (
                    <label key={skill.assignmentId}>
                        <input
                            type="checkbox"
                            checked={skill.completed}
                            onChange={() => handleSkillChange(skill.assignmentId)}
                        /> {skill.assignmentTitle}
                    </label>
                ))}
            </div>

            <div className={styles.evaluationCell}>
                <button onClick={handleSaveClick} className={styles.saveButton}>Save</button>
            </div>
        </div>
    );
};

export default EvaluationRow;