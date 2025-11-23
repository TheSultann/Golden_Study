// src/api.js

import axios from 'axios';

const API = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL
});

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
            localStorage.removeItem('userToken');
            localStorage.removeItem('userName');
            localStorage.removeItem('userRole');
            
            // 2. Force redirect user to login page.
            // This is the most reliable way that resets application state.
            window.location.href = '/login';
        }
        
        // For all other errors (404, 500, etc.) we just rethrow them,
        // so the component that made the request can handle them.
        return Promise.reject(error);
    }
);
// --- END OF NEW BLOCK ---

export default API;