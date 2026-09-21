import axiosInstance from './axiosInstance';
import type {LoginRequest, RegisterRequest, AuthResponse} from './types';

export const login = async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await axiosInstance.post<AuthResponse>('/login', data);
    return response.data;
};

export const register = async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await axiosInstance.post<AuthResponse>('/register', data);
    return response.data;
};