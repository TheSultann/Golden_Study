import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { Switch, Route, Redirect } from 'react-router-dom';

import Sidebar from './components/Sidebar/Sidebar.jsx';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary.jsx';
import styles from './App.module.css';

// --- 1. IMPORTS FOR GLOBAL MODAL WINDOW ---
import { StudentProfileProvider, useStudentProfile } from './context/StudentProfileContext';
import StudentProfileCard from './components/StudentProfileCard/StudentProfileCard';

// --- Lazy Loaded Components ---
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const RegisterPage = lazy(() => import('./pages/RegisterPage.jsx'));
const LandingPage = lazy(() => import('./pages/LandingPage.jsx'));
const StudentDashboardLayout = lazy(() => import('./components/Dashboard/DashboardLayout.jsx'));
const TeacherDashboardLayout = lazy(() => import('./components/Dashboard/TeacherDashboard/TeacherDashboardLayout.jsx'));
const GroupsPage = lazy(() => import('./pages/GroupsPage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));
const FinancePage = lazy(() => import('./pages/FinancePage.jsx'));
const AccountingPage = lazy(() => import('./pages/AccountingPage.jsx'));
const TeachersOverviewPage = lazy(() => import('./pages/TeachersOverviewPage.jsx'));

// --- Fallback Component ---
const LoadingFallback = () => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f2f5' }}>
        <p>Loading...</p>
    </div>
);

// --- 2. COMPONENT FOR GLOBAL MODAL WINDOW MANAGEMENT ---
const GlobalStudentProfileModal = () => {
    const { visibleStudentId, hideProfile } = useStudentProfile();
    
    // Window is displayed only if there is a student ID in context
    if (!visibleStudentId) return null;
    
    return (
        <StudentProfileCard 
            studentId={visibleStudentId} 
            onClose={hideProfile} 
        />
    );
};

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

    // Memoize auth check to avoid unnecessary re-reads on every render
    const { token, role } = useMemo(() => ({
        token: localStorage.getItem('userToken'),
        role: localStorage.getItem('userRole')
    }), [userVersion]);

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
            <Suspense fallback={<LoadingFallback />}>
                <Switch>
                    <Route path="/login" component={LoginPage} />
                    <Route path="/register" component={RegisterPage} />
                    <Route path="/" exact component={LandingPage} />
                    <Redirect to="/" />
                </Switch>
            </Suspense>
        );
    }

    // --- 3. WRAP APPLICATION IN PROVIDER ---
    return (
        <StudentProfileProvider>
            <ErrorBoundary>
                <Suspense fallback={<LoadingFallback />}>
                    <Switch>
                        <Route path="/" exact>
                            {role === 'admin' && <Redirect to="/overview" />}
                            {role === 'teacher' && <TeacherDashboardLayout />}
                            {role === 'student' && <StudentDashboardLayout />}
                        </Route>

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
                </Suspense>
                {/* Render global modal window here, it will be managed through context */}
                <GlobalStudentProfileModal />
            </ErrorBoundary>
        </StudentProfileProvider>
    );
}

export default App;