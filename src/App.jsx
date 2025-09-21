import React, { useState, useEffect } from 'react';
import { Switch, Route, Redirect } from 'react-router-dom';

import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import LandingPage from './pages/LandingPage.jsx';
import StudentDashboardLayout from './components/Dashboard/DashboardLayout.jsx';
import TeacherDashboardLayout from './components/Dashboard/TeacherDashboard/TeacherDashboardLayout.jsx';
import GroupsPage from './pages/GroupsPage.jsx'; 
import SettingsPage from './pages/SettingsPage.jsx';
import Sidebar from './components/Sidebar/Sidebar.jsx';
import FinancePage from './pages/FinancePage.jsx';
import AccountingPage from './pages/AccountingPage.jsx';
import TeachersOverviewPage from './pages/TeachersOverviewPage.jsx';

import styles from './App.module.css';

function App() {
    const [userVersion, setUserVersion] = useState(0);

    useEffect(() => {
        const handleUserUpdate = () => {
            setUserVersion(v => v + 1); 
        };
        window.addEventListener('userProfileUpdated', handleUserUpdate);
        return () => {
            window.removeEventListener('userProfileUpdated', handleUserUpdate);
        };
    }, []);

    const token = localStorage.getItem('userToken');
    const role = localStorage.getItem('userRole');

    // Эта обертка нужна для страниц, у которых НЕТ своего макета
    const PrivateRouteWithLayout = ({ component: Component, ...rest }) => (
        <Route {...rest} render={props => (
            <div className={styles.pageLayout}>
                <Sidebar />
                <main className={styles.mainContent}>
                    <Component {...props} />
                </main>
            </div>
        )} />
    );

    const AdminRouteWithLayout = ({ component: Component, ...rest }) => {
        if (role !== 'admin') {
            return <Redirect to="/" />;
        }
        return <PrivateRouteWithLayout component={Component} {...rest} />;
    };

    const TeacherOrAdminRouteWithLayout = ({ component: Component, ...rest }) => {
        if (role !== 'teacher' && role !== 'admin') {
            return <Redirect to="/" />;
        }
        return <PrivateRouteWithLayout component={Component} {...rest} />;
    };

    if (!token) {
        return (
             <Switch>
                <Route path="/login" component={LoginPage} />
                <Route path="/register" component={RegisterPage} />
                <Route path="/" exact component={LandingPage} />
                <Redirect to="/" />
            </Switch>
        );
    }
    
    return (
        <Switch>
            <Route path="/" exact>
                {role === 'admin' && <Redirect to="/overview" />} 
                {role === 'teacher' && <TeacherDashboardLayout />}
                {role === 'student' && <StudentDashboardLayout />}
            </Route>

            {/* --- НОВЫЙ БЛОК: Отдельный защищенный роут для личной панели админа --- */}
            {/* Мы рендерим TeacherDashboardLayout напрямую, БЕЗ обертки, так как это уже готовый макет */}
            <Route path="/my-dashboard">
                {role === 'admin' ? <TeacherDashboardLayout /> : <Redirect to="/" />}
            </Route>

            <AdminRouteWithLayout path="/overview" component={TeachersOverviewPage} />
            <TeacherOrAdminRouteWithLayout path="/groups" component={GroupsPage} />
            
            <PrivateRouteWithLayout path="/settings" component={SettingsPage} />
            <AdminRouteWithLayout path="/finance" component={FinancePage} />
            <AdminRouteWithLayout path="/accounting" component={AccountingPage} />
            
            <Redirect to="/" />
        </Switch>
    );
}

export default App;