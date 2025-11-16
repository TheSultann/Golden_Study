import React, { useState, useEffect, useCallback } from 'react';
import API from '../../../api';
import styles from './TeacherDashboard.module.css';

const AttendanceTab = ({ lessonId }) => {
    const [students, setStudents] = useState([]);
    const [presentStudentIds, setPresentStudentIds] = useState(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const fetchAttendanceData = useCallback(async () => {
        if (!lessonId) return;
        setIsLoading(true);
        try {
            const res = await API.get(`/api/attendance/${lessonId}`);
            setStudents(res.data);
            const initialPresentIds = new Set(
                res.data.filter(s => s.status === 'present').map(s => s._id)
            );
            setPresentStudentIds(initialPresentIds);
        } catch (error) {
            console.error("Ошибка загрузки данных о посещаемости:", error);
            alert("Не удалось загрузить данные о посещаемости.");
        } finally {
            setIsLoading(false);
        }
    }, [lessonId]);

    useEffect(() => {
        fetchAttendanceData();
    }, [fetchAttendanceData]);

    const handleTogglePresence = (studentId) => {
        setPresentStudentIds(prevIds => {
            const newIds = new Set(prevIds);
            if (newIds.has(studentId)) {
                newIds.delete(studentId);
            } else {
                newIds.add(studentId);
            }
            return newIds;
        });
    };

    const handleSaveAttendance = async () => {
        setIsSaving(true);
        try {
            await API.post(`/api/attendance/${lessonId}`, {
                presentStudentIds: Array.from(presentStudentIds)
            });
            alert('Посещаемость сохранена!');
        } catch (error) {
            console.error("Ошибка сохранения посещаемости:", error);
            alert("Не удалось сохранить посещаемость.");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <p>Загрузка списка студентов...</p>;
    }

    return (
        <div className={styles.attendanceContainer}>
            <h4>Mark present students</h4>
            <div className={styles.attendanceList}>
                {students.map(student => (
                    <label key={student._id} className={styles.attendanceStudentRow}>
                        <input
                            type="checkbox"
                            checked={presentStudentIds.has(student._id)}
                            onChange={() => handleTogglePresence(student._id)}
                        />
                        <span>{student.name}</span>
                    </label>
                ))}
            </div>
            <div className={styles.formActions}>
                <button 
                    onClick={handleSaveAttendance} 
                    className={styles.submitButton}
                    disabled={isSaving}
                >
                    {isSaving ? 'Saving...' : 'Save'}
                </button>
            </div>
        </div>
    );
};

export default AttendanceTab;