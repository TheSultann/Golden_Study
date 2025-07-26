// src/api.js

import axios from 'axios';

const API = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL
});

API.interceptors.request.use((req) => {
    const token = localStorage.getItem('userToken');
    if (token) {
        req.headers.Authorization = `Bearer ${token}`;
    }
    return req;
});

export default API;