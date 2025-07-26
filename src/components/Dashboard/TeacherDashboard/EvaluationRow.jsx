// src/components/Dashboard/TeacherDashboard/EvaluationRow.jsx (ИЗМЕНЕННЫЙ)

import React, { useState } from 'react';
import styles from './TeacherDashboard.module.css';
import API from '../../../api'; // <-- ИМПОРТИРУЕМ НАШ ФАЙЛ

// Убираем 'token' из пропсов, он больше не нужен
const EvaluationRow = ({ studentData, lessonId, onSave }) => {
    const [evaluation, setEvaluation] = useState(studentData.evaluation);

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
            // --- ИЗМЕНЕНИЕ ЗДЕСЬ ---
            const res = await API.post('/api/evaluations', {
                lessonId,
                studentId: studentData.student._id,
                grade: Number(evaluation.grade) || 0,
                skills: evaluation.skills,
            });
            // --- КОНЕЦ ИЗМЕНЕНИЯ ---

            const savedEvaluation = res.data;
            alert(`Оценка для ${studentData.student.name} сохранена.`);
            onSave(studentData.student._id, savedEvaluation);
            
        } catch (error) {
            console.error("Ошибка:", error);
            alert(error.response?.data?.message || 'Ошибка сохранения');
        }
    };
    
    return (
        <div className={styles.evaluationRow}>
            <span className={styles.studentNameCell}>{studentData.student.name}</span>
            <div>
                <input
                    type="number"
                    min="0"
                    max="100"
                    value={evaluation.grade}
                    onChange={handleGradeChange}
                    placeholder="%"
                />
            </div>
            <div className={styles.skillsCell}>
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
            <div>
                <button onClick={handleSaveClick} className={styles.saveButton}>Сохранить</button>
            </div>
        </div>
    );
};

export default EvaluationRow;