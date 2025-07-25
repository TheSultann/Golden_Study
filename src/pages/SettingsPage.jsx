import React, { useState, useEffect } from 'react';
import styles from './SettingsPage.module.css';
import axios from 'axios';

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
        // Убираем ошибку, как только пользователь начинает редактировать поле
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
            setError('Имя не может быть пустым');
            setIsLoading(false);
            return;
        }

        try {
            const token = localStorage.getItem('userToken');
            const response = await axios.put(
                '/api/user/profile',
                { name },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            localStorage.setItem('userName', response.data.user.name);
            setMessage(response.data.message);
            // Сбрасываем сообщение об успехе через 3 секунды
            setTimeout(() => setMessage(''), 3000);

        } catch (err) {
            setError(err.response?.data?.message || 'Ошибка при обновлении профиля');
        } finally {
            setIsLoading(false);
        }
    };
    
    // ИСПРАВЛЕНИЕ: Правильно определяем, какой класс применить к сообщению
    const messageClassName = error 
        ? styles.errorMessage 
        : (message ? styles.successMessage : '');

    return (
        <div className={styles.settingsWrapper}>
            <div className={styles.settingsContainer}>
                <div className={styles.header}>
                    <h2>Настройки профиля</h2>
                    <p>Здесь вы можете обновить информацию о себе.</p>
                </div>
                
                <form onSubmit={handleSubmit} className={styles.settingsForm}>
                    <div className={styles.formGroup}>
                        <label htmlFor="name">Ваше имя</label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={handleNameChange} // ИСПРАВЛЕНИЕ: Используем новый обработчик
                            className={styles.input}
                            placeholder='Введите ваше имя'
                        />
                    </div>
                    
                    <div className={styles.footer}>
                        <div className={`${styles.message} ${messageClassName}`}>
                            {message || error}
                        </div>
                        
                        <button type="submit" className={styles.saveButton} disabled={isLoading}>
                            {isLoading ? 'Сохранение...' : 'Сохранить изменения'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SettingsPage;