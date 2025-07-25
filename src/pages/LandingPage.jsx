import React from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css'; // Подключаем стили

function LandingPage() {
    return (
        <div className="landing-container">
            <div className="landing-content">
                <h1>Добро пожаловать!</h1>
                <p>Платформа для обучения и отслеживания прогресса.</p>
                <div className="landing-actions">
                    <Link to="/login" className="landing-button">
                        Войти
                    </Link>
                    <Link to="/register" className="landing-button secondary">
                        Регистрация
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default LandingPage;