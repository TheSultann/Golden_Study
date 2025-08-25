// src/App.jsx

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

import styles from './App.module.css';

function App() {
    // --- ИЗМЕНЕНИЕ ЗДЕСЬ ---
    // Состояние-триггер для принудительной перерисовки приложения при обновлении данных пользователя.
    const [userVersion, setUserVersion] = useState(0);

    useEffect(() => {
        // Обработчик кастомного события, который обновит состояние и вызовет ре-рендер.
        const handleUserUpdate = () => {
            setUserVersion(v => v + 1); 
        };

        // Подписываемся на событие 'userProfileUpdated', которое отправляет SettingsPage.
        window.addEventListener('userProfileUpdated', handleUserUpdate);

        // Очищаем подписку при размонтировании компонента, чтобы избежать утечек памяти.
        return () => {
            window.removeEventListener('userProfileUpdated', handleUserUpdate);
        };
    }, []); // Пустой массив зависимостей гарантирует, что эффект выполнится только один раз.

    // Данные из localStorage будут перечитываться при каждом ре-рендере, вызванном изменением userVersion.
    const token = localStorage.getItem('userToken');
    const role = localStorage.getItem('userRole');
    // --- КОНЕЦ ИЗМЕНЕНИЯ ---

    // Обертка для страниц (группы, настройки), которые используют ОБЩИЙ макет
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

    // Если пользователь НЕ авторизован
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
    
    // Если пользователь АВТОРИЗОВАН
    return (
        <Switch>
            {/* ГЛАВНАЯ СТРАНИЦА (/): использует свой собственный компонент-макет */}
            <Route path="/" exact>
                {role === 'teacher' ? <TeacherDashboardLayout /> : <StudentDashboardLayout />}
            </Route>

            {/* ОСТАЛЬНЫЕ СТРАНИЦЫ: используют общий макет через PrivateRouteWithLayout */}
            <PrivateRouteWithLayout path="/groups" component={GroupsPage} />
            <PrivateRouteWithLayout path="/settings" component={SettingsPage} />
            
            <Redirect to="/" />
        </Switch>
    );
}

export default App;