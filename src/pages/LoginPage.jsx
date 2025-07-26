// src/pages/LoginPage.jsx (ИЗМЕНЕННЫЙ)

import React, { useState } from 'react';
import { useHistory, Link } from 'react-router-dom';
import './LoginPage.css';
import API from '../api'; // <-- ИМПОРТИРУЕМ НАШ ФАЙЛ

function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const history = useHistory();

    const handleLogin = async (event) => {
        event.preventDefault();
        
        try {
            // --- ИЗМЕНЕНИЕ ЗДЕСЬ ---
            // Используем наш API. Путь теперь '/api/auth/login'
            const response = await API.post('/api/auth/login', { email, password });
            const data = response.data;
            // --- КОНЕЦ ИЗМЕНЕНИЯ ---

            localStorage.setItem('userToken', data.token);
            localStorage.setItem('userRole', data.role);
            localStorage.setItem('userName', data.name); 

            history.push('/');
            window.location.reload();

        } catch (error) {
            // Ошибка от axios будет более информативной
            alert(error.response?.data?.message || 'Ошибка входа');
        }
    };

    return (
        <div className="login-page-container">
            <div className="login-form-wrapper">
                <div className="login-header">
                    <h2>Вход</h2>
                    <p>Войдите, чтобы получить доступ к вашим урокам</p>
                </div>

                <form onSubmit={handleLogin} className="login-form">
                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Введите ваш email"
                            required
                            className="input-field"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Пароль</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Введите ваш пароль"
                            required
                            className="input-field"
                        />
                    </div>

                    <div className="form-actions">
                        <button type="submit" className="login-button">
                            Войти
                        </button>
                    </div>
                </form>

                <div className="signup-link">
                    Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;