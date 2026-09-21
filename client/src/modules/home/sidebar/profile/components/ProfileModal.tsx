import * as React from 'react';
import { getProfile, updateProfile, uploadAvatar } from '../api/api';
import type { UserProfile, EditUserDto } from '../api/types';
import { useNavigate } from 'react-router-dom';
import axios, { AxiosError } from 'axios';
import { assetUrl } from '../../../../../utils/assetUrl';

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    profile: UserProfile | null;
    setProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
}

    const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, profile, setProfile }) => {
    const navigate = useNavigate();
    const [editMode, setEditMode] = React.useState(false);
    const [formData, setFormData] = React.useState<EditUserDto>({
        displayName: profile?.name || '',
        username: profile?.username || '',
        bio: profile?.bio || '',
        birthDate: profile?.birthDate || ''
    });
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState('');
    const [uploadingAvatar, setUploadingAvatar] = React.useState(false);
    const [avatarError, setAvatarError] = React.useState('');

    // Редактируемые поля заполняются только при входе в режим редактирования —
    // обновление профиля (например, загрузка аватара) не сбрасывает введённые данные
    const startEdit = () => {
        if (profile) {
            setFormData({
                displayName: profile.name,
                username: profile.username,
                bio: profile.bio || '',
                birthDate: profile.birthDate || ''
            });
        }
        setEditMode(true);
    };

    const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setAvatarError('');
        setUploadingAvatar(true);
        try {
            const avatarUrl = await uploadAvatar(file);
            // обновляем превью сразу, но НЕ выходим из редактирования и НЕ трогаем formData
            setProfile(prev => (prev ? { ...prev, avatar: avatarUrl } : prev));
        } catch (err: unknown) {
            const axiosError = err as AxiosError<{ message?: string }>;
            setAvatarError(axiosError.response?.data?.message || (err as Error).message || 'Не удалось загрузить фото');
        } finally {
            setUploadingAvatar(false);
            e.target.value = '';
        }
    };

    const fetchProfile = React.useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const data = await getProfile();
            setProfile(data);
        } catch (error: unknown) {
            console.error('Profile load error:', error);
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError<{ message?: string }>;
                setError(axiosError.response?.data?.message || 'Failed to load profile');
                if (axiosError.response?.status === 401) {
                    handleLogout();
                }
            } else {
                setError((error as Error).message || 'Failed to load profile');
            }
        } finally {
            setIsLoading(false);
        }
    }, [setProfile]);

    React.useEffect(() => {
        if (isOpen && !profile) {
            fetchProfile().catch(console.error);
        }
    }, [isOpen, profile, fetchProfile]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        if (formData.displayName.length < 3 || formData.username.length < 3) {
            setError('Display Name and Username must be at least 3 characters');
            return;
        }

        setIsLoading(true);
        setError('');
        try {
            const updatedProfile = await updateProfile(formData);
            setProfile(updatedProfile);
            setEditMode(false);
        } catch (error: unknown) {
            console.error('Profile update failed:', error);
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError<{ message?: string }>;
                setError(axiosError.response?.data?.message || 'Failed to update profile');
            } else {
                setError((error as Error).message || 'Failed to update profile');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 z-50">
            <div className="bg-[#17212b] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden border border-white/5 max-h-[92dvh] flex flex-col">
                <div className="p-6 overflow-y-auto overscroll-contain">
                    <div className="flex justify-between items-start mb-6">
                        <h2 className="text-xl font-bold text-white">
                            {editMode ? 'Редактирование' : 'Профиль'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-[#8f9aa7] hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10"
                            disabled={isLoading}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 text-red-400 rounded-lg text-sm border border-red-500/25">
                            {error}
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#5865F2] mb-4"></div>
                            <p className="text-[#8f9aa7] text-sm">
                                {editMode ? 'Сохраняем…' : 'Загружаем профиль…'}
                            </p>
                        </div>
                    ) : editMode ? (
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="block text-xs font-medium text-[#8f9aa7] mb-1 uppercase tracking-wider">
                                    Никнейм <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="displayName"
                                    value={formData.displayName}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 bg-[#0e1621] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5865F2] border border-white/5 transition-all"
                                    placeholder="Как вас видят другие"
                                    minLength={3}
                                    required
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="block text-xs font-medium text-[#8f9aa7] mb-1 uppercase tracking-wider">
                                    Логин <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 bg-[#0e1621] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5865F2] border border-white/5 transition-all"
                                    placeholder="username"
                                    minLength={3}
                                    required
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="block text-xs font-medium text-[#8f9aa7] mb-1 uppercase tracking-wider">О себе</label>
                                <textarea
                                    name="bio"
                                    value={formData.bio}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 bg-[#0e1621] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5865F2] border border-white/5 transition-all min-h-[100px] resize-none"
                                    placeholder="Расскажите о себе"
                                    rows={3}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="block text-xs font-medium text-[#8f9aa7] mb-1 uppercase tracking-wider">Аватар</label>
                                <div className="flex items-center space-x-3">
                                    {assetUrl(profile?.avatar) ? (
                                        <img
                                            src={assetUrl(profile?.avatar)}
                                            alt="Preview"
                                            className="w-10 h-10 rounded-full object-cover ring-2 ring-white/10"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-[#222d3d] flex items-center justify-center ring-2 ring-white/10">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#5d6b7b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                        </div>
                                    )}
                                    <label
                                        className="flex-1 cursor-pointer flex items-center justify-center gap-2 px-4 py-2.5 bg-[#222d3d] hover:bg-[#2b3646] text-white text-sm rounded-xl transition-all cursor-pointer"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                        </svg>
                                        {uploadingAvatar ? 'Загружаем…' : 'Выбрать фото'}
                                        <input
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp,image/gif"
                                            className="hidden"
                                            onChange={handleAvatarFile}
                                            disabled={uploadingAvatar}
                                        />
                                    </label>
                                </div>
                                {avatarError && <p className="text-red-400 text-xs mt-1">{avatarError}</p>}
                            </div>

                            <div className="space-y-1">
                                <label className="block text-xs font-medium text-[#8f9aa7] mb-1 uppercase tracking-wider">Дата рождения</label>
                                <input
                                    type="date"
                                    name="birthDate"
                                    value={formData.birthDate}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 bg-[#0e1621] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5865F2] border border-white/5 transition-all [color-scheme:dark]"
                                />
                            </div>

                            <div className="flex space-x-3 pt-2">
                                <button
                                    onClick={() => setEditMode(false)}
                                    disabled={isLoading}
                                    className="flex-1 bg-[#222d3d] hover:bg-[#2b3646] text-white font-medium py-2.5 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Отмена
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isLoading}
                                    className="flex-1 bg-[#5865F2] hover:bg-[#4752c4] text-white font-medium py-2.5 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                >
                                    {isLoading ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Сохраняем…
                                        </>
                                    ) : 'Сохранить'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            <div className="flex flex-col items-center">
                                <div className="relative mb-3">
                                    {assetUrl(profile?.avatar) ? (
                                        <img
                                            src={assetUrl(profile?.avatar)}
                                            alt="Profile"
                                            className="w-28 h-28 rounded-full object-cover ring-4 ring-white/10 shadow-lg"
                                        />
                                    ) : (
                                        <div className="w-28 h-28 rounded-full bg-[#222d3d] flex items-center justify-center ring-4 ring-white/10">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-[#5d6b7b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                                <h3 className="text-xl font-bold text-white selectable">{profile?.name || 'Без имени'}</h3>
                                <p className={`text-sm mt-1 ${profile?.status === 'online' ? 'text-[#8ea1ff]' : 'text-[#8f9aa7]'}`}>
                                    {profile?.status === 'online' ? 'онлайн' : 'не в сети'}
                                </p>
                            </div>

                            {/* Информация: строки в стиле Telegram */}
                            <div className="mx-1">
                                <div className="flex items-start gap-4 px-3 py-2.5">
                                    <span className="text-[#8f9aa7] mt-0.5 shrink-0">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                            <circle cx="12" cy="7" r="4" />
                                        </svg>
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-sm text-white selectable">@{profile?.username || 'username'}</span>
                                        <span className="block text-xs text-[#8f9aa7] mt-0.5">Имя пользователя</span>
                                    </span>
                                </div>

                                <div className="flex items-start gap-4 px-3 py-2.5">
                                    <span className="text-[#8f9aa7] mt-0.5 shrink-0">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                            <polyline points="14 2 14 8 20 8" />
                                            <line x1="16" y1="13" x2="8" y2="13" />
                                            <line x1="16" y1="17" x2="8" y2="17" />
                                        </svg>
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-sm text-white break-words">
                                            {profile?.bio ? profile.bio : <span className="text-[#5d6b7b] italic">Пока ничего не рассказано</span>}
                                        </span>
                                        <span className="block text-xs text-[#8f9aa7] mt-0.5">О себе</span>
                                    </span>
                                </div>

                                <div className="flex items-start gap-4 px-3 py-2.5">
                                    <span className="text-[#8f9aa7] mt-0.5 shrink-0">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                                            <rect x="3" y="4" width="18" height="18" rx="2" />
                                            <line x1="16" y1="2" x2="16" y2="6" />
                                            <line x1="8" y1="2" x2="8" y2="6" />
                                            <line x1="3" y1="10" x2="21" y2="10" />
                                        </svg>
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-sm text-white">
                                            {profile?.birthDate ? new Date(profile.birthDate).toLocaleDateString() : <span className="text-[#5d6b7b] italic">Не указана</span>}
                                        </span>
                                        <span className="block text-xs text-[#8f9aa7] mt-0.5">Дата рождения</span>
                                    </span>
                                </div>
                            </div>

                            <div className="flex space-x-3 pt-1">
                                <button
                                    onClick={startEdit}
                                    className="flex-1 bg-[#5865F2] hover:bg-[#4752c4] text-white text-sm font-medium py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    Редактировать
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className="flex-1 bg-[#222d3d] hover:bg-[#2b3646] text-white text-sm font-medium py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                    Выйти
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProfileModal;