import React, { useState } from 'react';
import styles from './TeacherDashboard.module.css';
import API from '../../../api';
// --- 1. ИМПОРТИРУЕМ ХУК ДЛЯ ДОСТУПА К КОНТЕКСТУ ---
import { useStudentProfile } from '../../../context/StudentProfileContext';

const EvaluationRow = ({ studentData, lessonId, onSave }) => {
    const [evaluation, setEvaluation] = useState(studentData.evaluation);
    // --- 2. ПОЛУЧАЕМ ФУНКЦИЮ ДЛЯ ВЫЗОВА МОДАЛЬНОГО ОКНА ---
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
            alert(`Оценка для ${studentData.student.name} сохранена.`);
            onSave(studentData.student._id, savedEvaluation);
            
        } catch (error) {
            console.error("Ошибка:", error);
            alert(error.response?.data?.message || 'Ошибка сохранения');
        }
    };
    
    return (
        <div className={styles.evaluationRow}>
            {/* --- 3. ДЕЛАЕМ ИМЯ СТУДЕНТА КЛИКАБЕЛЬНЫМ --- */}
            <span 
                className={`${styles.studentNameCell} ${styles.clickableStudentName}`}
                onClick={() => showProfile(studentData.student._id)}
                title={`Посмотреть профиль ${studentData.student.name}`}
            >
                {studentData.student.name}
            </span>
            {/* --- КОНЕЦ ИЗМЕНЕНИЙ --- */}
            
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
                <button onClick={handleSaveClick} className={styles.saveButton}>Save</button>
            </div>
        </div>
    );
};

export default EvaluationRow;