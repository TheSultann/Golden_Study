export const AUTH_CHANGED_EVENT = 'golden-study-auth-changed';

const AUTH_STORAGE_KEYS = ['userToken', 'userName', 'userRole', 'userId'];

const decodeJwtPayload = (token) => {
    const [, payload] = token.split('.');
    if (!payload) return null;

    const normalizedPayload = payload
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(Math.ceil(payload.length / 4) * 4, '=');

    return JSON.parse(atob(normalizedPayload));
};

export const isTokenExpired = (token) => {
    if (!token) return true;

    try {
        const payload = decodeJwtPayload(token);
        if (!payload?.exp) return true;
        return payload.exp * 1000 <= Date.now();
    } catch {
        return true;
    }
};

export const clearAuthStorage = () => {
    AUTH_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
};

export const readAuthState = () => {
    const token = localStorage.getItem('userToken');
    const role = localStorage.getItem('userRole');

    if (token && isTokenExpired(token)) {
        clearAuthStorage();
        return { token: null, role: null };
    }

    return { token, role };
};
