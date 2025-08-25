// src/pages/SettingsPage.jsx

import React, { useState, useEffect } from 'react';
import styles from './SettingsPage.module.css';
import API from '../api';

const SettingsPage = () => {
    const [name, setName] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const currentName = localStorage.getItem('userName');
        if (currentName) {
            setName(currentName);
        }
    }, []);

    const handleNameChange = (e) => {
        setName(e.target.value);
        if (error) {
            setError('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');
        setIsLoading(true);

        if (!name.trim()) {
            setError('Name cannot be empty');
            setIsLoading(false);
            return;
        }

        try {
            const response = await API.put('/api/user/profile', { name });

            localStorage.setItem('userName', response.data.user.name);
            window.dispatchEvent(new Event('userProfileUpdated'));

            setMessage(response.data.message);
            setTimeout(() => setMessage(''), 3000);

        } catch (err) { // <--- Убрана стрелка =>
            setError(err.response?.data?.message || 'Ошибка при обновлении профиля');
        } finally {
            setIsLoading(false);
        }
    };
    
    const messageClassName = error 
        ? styles.errorMessage 
        : (message ? styles.successMessage : '');

    return (
        <div className={styles.settingsWrapper}>
            <div className={styles.settingsContainer}>
                <div className={styles.header}>
                    <h2>Profile Settings</h2>
                    <p>Here you can update your information..</p>
                </div>
                
                <form onSubmit={handleSubmit} className={styles.settingsForm}>
                    <div className={styles.formGroup}>
                        <label htmlFor="name">Your Name</label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={handleNameChange}
                            className={styles.input}
                            placeholder='Enter your name'
                        />
                    </div>
                    
                    <div className={styles.footer}>
                        <div className={`${styles.message} ${messageClassName}`}>
                            {message || error}
                        </div>
                        
                        <button type="submit" className={styles.saveButton} disabled={isLoading}>
                            {isLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SettingsPage;