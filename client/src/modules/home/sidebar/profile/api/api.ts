import axiosInstance from './axiosInstance';
import type { UserProfile, EditUserDto } from './types';
import axios, { type AxiosError } from 'axios';

export const getProfile = async (): Promise<UserProfile> => {
    try {
        const { data } = await axiosInstance.get('/users/me');
        console.log('API Response (getProfile):', data);
        return {
            id: data._id,
            name: data.public.displayName,
            username: data.public.username,
            status: data.public.status || 'offline',
            bio: data.public.bio || '',
            avatar: data.public.avatar || '',
            profileLink: data.public.profileLink || '',
            birthDate: data.public.birthDate,
            settings: data.settings || {},
            createdAt: data.createdAt,
            updatedAt: data.updatedAt
        };
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError<{ message: string }>;
            console.error('Get profile error:', axiosError.response?.data || axiosError.message);
            throw new Error(axiosError.response?.data?.message || 'Failed to fetch profile');
        }
        throw new Error((error as Error).message || 'Failed to fetch profile');
    }
};

export const updateProfile = async (dto: EditUserDto): Promise<UserProfile> => {
    try {
        console.log('Sending update request with data:', dto);
        const { data } = await axiosInstance.put('/users/me', {
            displayName: dto.displayName,
            username: dto.username,
            bio: dto.bio,
            profileLink: dto.profileLink,
            birthDate: dto.birthDate
        });
        console.log('API Response (updateProfile):', data);
        return {
            id: data._id,
            name: data.public.displayName,
            username: data.public.username,
            status: data.public.status || 'offline',
            bio: data.public.bio || '',
            avatar: data.public.avatar || '',
            profileLink: data.public.profileLink || '',
            birthDate: data.public.birthDate,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt
        };
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError<{ message: string }>;
            console.error('Update profile error:', {
                status: axiosError.response?.status,
                data: axiosError.response?.data,
                config: axiosError.config
            });
            throw new Error(axiosError.response?.data?.message || 'Failed to update profile');
        }
        throw new Error((error as Error).message || 'Failed to update profile');
    }
};

// Загрузка аватара файлом с устройства
export const uploadAvatar = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('avatar', file);
    const { data } = await axiosInstance.post<{ avatar: string }>('/users/me/avatar', formData);
    return data.avatar;
};