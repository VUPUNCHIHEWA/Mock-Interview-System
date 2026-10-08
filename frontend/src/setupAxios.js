import axios from 'axios';

// Only our own backend should ever receive the login token.
// (Other sites, e.g. api.github.com, must NOT get it.)
const BACKEND_HOSTS = ['localhost:8000', '127.0.0.1:8000'];

// Attach "Authorization: Bearer <token>" to every request to our backend.
axios.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (!token) return config;

    try {
        const url = new URL(config.url, window.location.origin);
        if (BACKEND_HOSTS.includes(url.host)) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    } catch {
        // invalid URL - leave the request unchanged
    }
    return config;
});

// If the server says the token is missing/expired (401), clear the login and go to /login.
axios.interceptors.response.use(
    (response) => response,
    (error) => {
        const hadToken = !!localStorage.getItem('token');
        if (error.response?.status === 401 && hadToken) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('userId');
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);