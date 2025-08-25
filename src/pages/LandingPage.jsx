import React from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css'; // Подключаем стили

function LandingPage() {
    return (
        <div className="landing-container">
            <div className="landing-content">
                <h1>Welcome to Golden Study!</h1>
                <p>A platform for learning and tracking progress.</p>
                <div className="landing-actions">
                    <Link to="/login" className="landing-button">
                    Sign In
                    </Link>
                    <Link to="/register" className="landing-button secondary">
                    Sign Up
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default LandingPage;