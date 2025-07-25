import React from 'react';
import Sidebar from "../Sidebar/Sidebar.jsx";
import StudentDashboard from "./StudentDashboard/StudentDashboard.jsx";
import styles from '../../App.module.css';

function DashboardLayout(props) {
    return (
        <div className={styles.appContainer}>
            <Sidebar />
            <main className={styles.mainContent}>
                <StudentDashboard/>
            </main>
        </div>
    );
}

export default DashboardLayout;