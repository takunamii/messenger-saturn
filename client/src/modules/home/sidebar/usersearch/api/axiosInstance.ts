import axios from 'axios';

const axiosInstance = axios.create({
    baseURL: import.meta.env?.VITE_API_URL || 'http://localhost:3000',
    headers: {
        'Content-Type': 'application/json',
    },
    transformRequest: [
        (data, headers) => {
            if (data instanceof FormData) {
                delete headers['Content-Type'];
                return data;
            }
            return JSON.stringify(data);
        }
    ]
});

// РРЅС‚РµСЂСЃРµРїС‚РѕСЂ РґР»СЏ РґРѕР±Р°РІР»РµРЅРёСЏ С‚РѕРєРµРЅР°
axiosInstance.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    console.log('Token used:', token ? `Bearer ${token}` : 'Absent');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    } else {
        console.warn('No token found in localStorage');
    }
    return config;
});

// РРЅС‚РµСЂСЃРµРїС‚РѕСЂ РґР»СЏ РѕР±СЂР°Р±РѕС‚РєРё РѕС€РёР±РѕРє
axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;
