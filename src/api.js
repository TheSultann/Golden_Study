// src/api.js

import axios from 'axios';

const API = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL
});

// Этот перехватчик добавляет токен в каждый запрос (без изменений)
API.interceptors.request.use((req) => {
    const token = localStorage.getItem('userToken');
    if (token) {
        req.headers.Authorization = `Bearer ${token}`;
    }
    return req;
});

// --- НОВЫЙ БЛОК: ГЛОБАЛЬНЫЙ ОБРАБОТЧИК ОШИБОК ---
// Этот перехватчик будет проверять КАЖДЫЙ ответ от сервера.
API.interceptors.response.use(
    // Если ответ успешный (код 2xx), просто возвращаем его дальше.
    (response) => response,
    // Если сервер вернул ошибку...
    (error) => {
        // Проверяем, является ли эта ошибка "401 Unauthorized".
        // Это стандартный код для истекшего или неверного токена.
        if (error.response && error.response.status === 401) {
            // 1. Очищаем все данные пользователя из localStorage.
            localStorage.removeItem('userToken');
            localStorage.removeItem('userName');
            localStorage.removeItem('userRole');
            
            // 2. Принудительно перенаправляем пользователя на страницу входа.
            // Это самый надежный способ, который сбрасывает состояние приложения.
            window.location.href = '/login';
        }
        
        // Для всех остальных ошибок (404, 500 и т.д.) мы просто пробрасываем их дальше,
        // чтобы компонент, который делал запрос, мог их обработать.
        return Promise.reject(error);
    }
);
// --- КОНЕЦ НОВОГО БЛОКА ---

export default API;