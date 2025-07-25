// src/pages/RegisterPage.jsx (ИЗМЕНЕННЫЙ)

import React, { useState } from 'react';
import { useHistory, Link } from 'react-router-dom';
import './register.css';
import API from '../api'; // <-- ИМПОРТИРУЕМ НАШ ФАЙЛ

function RegisterPage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const history = useHistory();

    const handleRegister = async (event) => {
        event.preventDefault();

        if (password !== confirmPassword) {
            alert("Пароли не совпадают!");
            return;
        }
        
        try {
            // --- ИЗМЕНЕНИЕ ЗДЕСЬ ---
            // Используем наш API. Путь теперь '/api/auth/register'
            await API.post('/api/auth/register', { name, email, password });
            // --- КОНЕЦ ИЗМЕНЕНИЯ ---
            
            alert('Регистрация успешна! Теперь вы можете войти.');
            history.push('/login');

        } catch (error) {
            alert(error.response?.data?.message || 'Ошибка регистрации');
        }
    };

    return (
        <div className="register-page-container">
            <div className="register-form-wrapper">
                <div className="register-header">
                    <h2>Регистрация</h2>
                    <p>Создайте аккаунт, чтобы начать обучение</p>
                </div>

                <form onSubmit={handleRegister} className="register-form">
                    <div className="form-group">
                        <label htmlFor="name">Ваше имя</label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Введите ваше имя"
                            required
                            className="input-field"
                        />
                    </div>

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
                            placeholder="Создайте пароль"
                            required
                            className="input-field"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirm-password">Подтвердите пароль</label>
                        <input
                            type="password"
                            id="confirm-password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Повторите ваш пароль"
                            required
                            className="input-field"
                        />
                    </div>

                    <div className="form-actions">
                        <button type="submit" className="register-button">
                            Зарегистрироваться
                        </button>
                    </div>
                </form>

                <div className="login-link">
                    Уже есть аккаунт? <Link to="/login">Войти</Link>
                </div>
            </div>
        </div>
    );
}

export default RegisterPage;