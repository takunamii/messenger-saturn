import axios from 'axios';

const API_BASE = import.meta.env?.VITE_API_URL || 'http://localhost:3000';

const API_BASE_URL = `${API_BASE}/auth`;

const axiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        const message: string = error.response?.data?.message || 'РџСЂРѕРёР·РѕС€Р»Р° РѕС€РёР±РєР°';
        return Promise.reject({ message });
    }
);

export default axiosInstance;
