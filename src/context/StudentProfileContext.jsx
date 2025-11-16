import React, { createContext, useState, useContext, useMemo } from 'react';

// 1. Создаем контекст
const StudentProfileContext = createContext(null);

// 2. Создаем компонент-провайдер, который будет "оберткой" для приложения
export const StudentProfileProvider = ({ children }) => {
    const [studentId, setStudentId] = useState(null);

    // Функции для управления состоянием, которые будут доступны всем дочерним компонентам
    const showProfile = (id) => setStudentId(id);
    const hideProfile = () => setStudentId(null);

    // Оборачиваем значение в useMemo для оптимизации, чтобы избежать лишних ре-рендеров
    const value = useMemo(() => ({
        visibleStudentId: studentId,
        showProfile,
        hideProfile
    }), [studentId]);

    return (
        <StudentProfileContext.Provider value={value}>
            {children}
        </StudentProfileContext.Provider>
    );
};

// 3. Создаем кастомный хук для удобного доступа к контексту
export const useStudentProfile = () => {
    const context = useContext(StudentProfileContext);
    if (!context) {
        throw new Error('useStudentProfile должен использоваться внутри StudentProfileProvider');
    }
    return context;
};