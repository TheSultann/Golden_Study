// src/pages/LoginPage.jsx (MODIFIED)

import React, { useState } from 'react';
import { useHistory, Link } from 'react-router-dom';
import './LoginPage.css';
import API from '../api'; // <-- Import our file

function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const history = useHistory();

    const handleLogin = async (event) => {
        event.preventDefault();
        
        if (isLoading) return; // Prevent multiple submissions
        
        setIsLoading(true);
        try {
            const response = await API.post('/api/auth/login', { email, password });
            const data = response.data;

            localStorage.setItem('userToken', data.token);
            localStorage.setItem('userRole', data.role);
            localStorage.setItem('userName', data.name); 

            // Use window.location.href instead of history.push + reload for clean state reset
            window.location.href = '/';

        } catch (error) {
            alert(error.response?.data?.message || 'Login error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-page-container">
            <div className="login-form-wrapper">
                <div className="login-header">
                    <h2>Sign In</h2>
                    <p>Sign in to access your lessons</p>
                </div>

                <form onSubmit={handleLogin} className="login-form">
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
                            placeholder="Enter your password"
                            required
                            className="input-field"
                        />
                    </div>

                    <div className="form-actions">
                        <button type="submit" className="login-button" disabled={isLoading}>
                           {isLoading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </div>
                </form>

                <div className="signup-link">
                Don't have an account? <Link to="/register">Sign Up</Link>
                <p className="copyright">Project by Sultan | v2.0.0</p>

                </div>
            </div>
        </div>
    );
}

export default LoginPage;