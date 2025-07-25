import React from 'react';
import Sidebar from '../../Sidebar/Sidebar.jsx';
import TeacherDashboard from './TeacherDashboard.jsx';
import styles from '../../../App.module.css';

function TeacherDashboardLayout() {
    return (
        <div className={styles.appContainer}>
            <Sidebar />
            <main className={styles.mainContent}>
                <TeacherDashboard />
            </main>
        </div>
    );
}

export default TeacherDashboardLayout;