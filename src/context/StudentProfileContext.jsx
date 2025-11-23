import React, { createContext, useState, useContext, useMemo } from 'react';

// 1. Create context
const StudentProfileContext = createContext(null);

// 2. Create provider component that will be a "wrapper" for the application
export const StudentProfileProvider = ({ children }) => {
    const [studentId, setStudentId] = useState(null);

    // Functions for state management that will be available to all child components
    const showProfile = (id) => setStudentId(id);
    const hideProfile = () => setStudentId(null);

    // Wrap value in useMemo for optimization to avoid unnecessary re-renders
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

// 3. Create custom hook for convenient context access
export const useStudentProfile = () => {
    const context = useContext(StudentProfileContext);
    if (!context) {
        throw new Error('useStudentProfile must be used within StudentProfileProvider');
    }
    return context;
};