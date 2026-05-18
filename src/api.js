// src/api.js

import axios from 'axios';
import { clearAuthStorage } from './auth';

const API = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
    timeout: 15000
});

let isRedirectingToLogin = false;

// This interceptor adds token to every request (unchanged)
API.interceptors.request.use((req) => {
    const token = localStorage.getItem('userToken');
    if (token) {
        req.headers.Authorization = `Bearer ${token}`;
    }
    return req;
});

// --- NEW BLOCK: GLOBAL ERROR HANDLER ---
// This interceptor will check EVERY response from the server.
API.interceptors.response.use(
    // If response is successful (2xx code), just return it.
    (response) => response,
    // If server returned an error...
    (error) => {
        // Check if this error is "401 Unauthorized".
        // This is the standard code for expired or invalid token.
        if (error.response && error.response.status === 401) {
            // 1. Clear all user data from localStorage.
            clearAuthStorage();
            
            // 2. Force redirect user to login page.
            // This is the most reliable way that resets application state.
            if (!isRedirectingToLogin && window.location.pathname !== '/login') {
                isRedirectingToLogin = true;
                window.location.replace('/login');
            }
        }
        
        // For all other errors (404, 500, etc.) we just rethrow them,
        // so the component that made the request can handle them.
        return Promise.reject(error);
    }
);
// --- END OF NEW BLOCK ---

export default API;
