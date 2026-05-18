// src/pages/RegisterPage.jsx (MODIFIED)

import React, { useState } from 'react';
import { useHistory, Link } from 'react-router-dom';
import './register.css';
import API from '../api'; // <-- Import our file

function RegisterPage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const history = useHistory();

    const handleRegister = async (event) => {
        event.preventDefault();

        if (isLoading) return; // Prevent multiple submissions

        if (password !== confirmPassword) {
            alert("Passwords do not match!");
            return;
        }

        if (password.length < 6) {
            alert("Password must be at least 6 characters long!");
            return;
        }
        
        setIsLoading(true);
        try {
            await API.post('/api/auth/register', { name, email, password });
            history.push('/login');

        } catch (error) {
            alert(error.response?.data?.message || 'Registration error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="register-page-container">
            <div className="register-form-wrapper">
                <div className="register-header">
                    <h2>Sign Up</h2>
                    <p>Create an account to start learning</p>
                </div>

                <form onSubmit={handleRegister} className="register-form">
                    <div className="form-group">
                        <label htmlFor="name">Your Name</label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter your name"
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
                            placeholder="Enter your email"
                            required
                            className="input-field"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Create a password"
                            required
                            className="input-field"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirm-password">Confirm Password</label>
                        <input
                            type="password"
                            id="confirm-password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Repeat your password"
                            required
                            className="input-field"
                        />
                    </div>

                    <div className="form-actions">
                        <button type="submit" className="register-button" disabled={isLoading}>
                        {isLoading ? 'Creating account...' : 'Sign Up'}
                        </button>
                    </div>
                </form>

                <div className="login-link">
                Already have an account? <Link to="/login">Sign In</Link>
                </div>
            </div>
        </div>
    );
}

export default RegisterPage;