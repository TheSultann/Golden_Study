import React, { useState } from 'react';
import { useHistory, Link } from 'react-router-dom';
import './register.css';

function RegisterPage() {
    // Возвращаем поле для имени
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
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                // Отправляем на сервер и имя
                body: JSON.stringify({ name, email, password })
            });
            
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Ошибка регистрации');
            }

            alert('Регистрация успешна! Теперь вы можете войти.');
            history.push('/login');

        } catch (error) {
            alert(error.message);
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
                    {/* ВОЗВРАЩАЕМ ПОЛЕ ДЛЯ ИМЕНИ */}
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