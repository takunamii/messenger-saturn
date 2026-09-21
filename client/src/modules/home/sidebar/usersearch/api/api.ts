import axiosInstance from './axiosInstance';
import type { Chat, User } from '../../Sidebar';
import type { AxiosError } from 'axios';

export interface ChatMessage {
    id: string;
    text: string;
    mine: boolean;
    readAt: string | null;
    type: MessageKind;
    replyTo: { id: string; senderId: string; text: string; type: string } | null;
    forwardedFrom: { id: string; displayName: string } | null;
    createdAt: string;
}

interface ChatDto {
    _id: string;
    name: string;
    lastMessage?: string;
    lastMessageAt?: string | null;
    unreadCount?: number;
    lastSeenAt?: string | null;
    avatar?: string;
    pinned?: boolean;
}

interface UserDto {
    _id: string;
    username?: string;
    displayName?: string;
    public?: { displayName?: string };
}

type MessageKind = 'text' | 'image' | 'video' | 'audio' | 'file' | 'deleted';

interface MessageDto {
    _id: string;
    mine?: boolean;
    createdAt: string;
    readAt?: string | null;
    type?: MessageKind;
    payload?: { payload?: string };
    replyTo?: { id: string; senderId: string; text: string; type: string } | null;
    forwardedFrom?: { id: string; displayName: string } | null;
    pinnedBy?: string;
    pinnedAt?: string;
}

interface MediaItemDto {
    _id: string;
    type: 'image' | 'video' | 'audio' | 'file';
    url: string;
    mine?: boolean;
    createdAt: string;
}

export interface ChatAttachment {
    _id: string;
    type: 'image' | 'video' | 'audio' | 'file';
    url: string;
    mine: boolean;
    createdAt: string;
}

interface PublicUserStatusDto {
    _id: string;
    public?: {
        displayName?: string;
        username?: string;
        status?: string;
        lastSeenAt?: string | null;
        bio?: string;
        avatar?: string;
    };
}

export interface PublicUserStatus {
    displayName: string;
    username: string;
    bio: string;
    avatar: string;
    online: boolean;
    lastSeenAt: string | null;
}

// Список переписок (чат неявный — это переписка с пользователем)
export const getChats = async (): Promise<Chat[]> => {
    try {
        const { data } = await axiosInstance.get<ChatDto[]>('/users/me/chats');
        return data.map((chat) => ({
            id: chat._id,
            name: chat.name,
            lastMessage: chat.lastMessage || 'No messages yet',
            lastMessageAt: chat.lastMessageAt ?? null,
            unreadCount: chat.unreadCount ?? 0,
            lastSeenAt: chat.lastSeenAt ?? null,
            avatar: chat.avatar ?? undefined,
            pinned: !!chat.pinned
        }));
    } catch (error: unknown) {
        const axiosError = error as AxiosError<{ message: string }>;
        console.error('Failed to fetch chats:', axiosError.response?.data || axiosError.message);
        return [];
    }
};

// Статус собеседника (для шапки чата)
export const getPartnerStatus = async (userId: string): Promise<PublicUserStatus | null> => {
    try {
        const { data } = await axiosInstance.get<PublicUserStatusDto>(`/users/${userId}/public`);
        return {
            displayName: data.public?.displayName || '',
            username: data.public?.username || '',
            bio: data.public?.bio || '',
            avatar: data.public?.avatar || '',
            online: data.public?.status === 'online',
            lastSeenAt: data.public?.lastSeenAt ?? null
        };
    } catch (error: unknown) {
        const axiosError = error as AxiosError<{ message: string }>;
        console.error('Failed to fetch partner status:', axiosError.response?.data || axiosError.message);
        return null;
    }
};

// Поиск пользователей
export const searchUsers = async (query: string): Promise<User[]> => {
    try {
        if (query.length < 3) {
            return [];
        }
        const params = { query: encodeURIComponent(query) };
        const { data } = await axiosInstance.get<UserDto[] | { data?: UserDto[] }>('/users/search', { params });
        const users = Array.isArray(data) ? data : data.data || [];
        return users.map((user) => ({
            id: user._id,
            name: user.username || user.public?.displayName || user.displayName || 'Unnamed'
        }));
    } catch (error: unknown) {
        const axiosError = error as AxiosError<{ message: string }>;
        console.error('Failed to search users:', axiosError.response?.data || axiosError.message);
        return [];
    }
};

// Сообщения переписки: newest-first пачка (курсорная пагинация через before)
export const getMessages = async (userId: string, before?: string): Promise<{ messages: ChatMessage[]; hasMore: boolean }> => {
    try {
        const params: Record<string, unknown> = { limit: 50 };
        if (before) params.before = before;
        const { data } = await axiosInstance.get<{ messages: MessageDto[]; hasMore?: boolean }>(`/chats/${userId}/messages`, { params });
        const messages = data.messages.map((msg) => ({
            id: msg._id,
            text: msg.payload?.payload ?? '',
            mine: !!msg.mine,
            readAt: msg.readAt ?? null,
            type: msg.type ?? 'text',
            replyTo: msg.replyTo ?? null,
            forwardedFrom: msg.forwardedFrom ?? null,
            createdAt: msg.createdAt
        }));
        return { messages, hasMore: !!data.hasMore };
    } catch (error: unknown) {
        const axiosError = error as AxiosError<{ message: string }>;
        console.error('Failed to fetch messages:', axiosError.response?.data || axiosError.message);
        return { messages: [], hasMore: false };
    }
};

// Отметить входящие прочитанными (когда чат открыт и сообщения пришли по WS)
export const markChatRead = async (userId: string): Promise<void> => {
    try {
        await axiosInstance.post(`/chats/${userId}/read`);
    } catch (error: unknown) {
        const axiosError = error as AxiosError<{ message: string }>;
        console.error('Failed to mark chat read:', axiosError.response?.data || axiosError.message);
    }
};

// Отправка сообщения пользователю (переписка создаётся автоматически)
export const sendMessage = async (userId: string, text: string, replyToId?: string | null): Promise<void> => {
    try {
        await axiosInstance.post(`/chats/${userId}/messages`, {
            type: 'text',
            payload: text,
            ...(replyToId ? { replyToId } : {})
        });
    } catch (error: unknown) {
        const axiosError = error as AxiosError<{ message: string }>;
        console.error('Failed to send message:', axiosError.response?.data || axiosError.message);
        throw error;
    }
};

// Переслать сообщение в переписку с пользователем
export const forwardMessage = async (userId: string, messageId: string): Promise<void> => {
    try {
        await axiosInstance.post(`/chats/${userId}/forward`, { messageId });
    } catch (error: unknown) {
        const axiosError = error as AxiosError<{ message: string }>;
        console.error('Failed to forward message:', axiosError.response?.data || axiosError.message);
        throw error;
    }
};

// Удаление сообщения: для себя / для всех (автора)
export const deleteMessage = async (userId: string, messageId: string, mode: 'self' | 'all'): Promise<void> => {
    try {
        await axiosInstance.delete(`/chats/${userId}/messages/${messageId}`, { params: { mode } });
    } catch (error: unknown) {
        const axiosError = error as AxiosError<{ message: string }>;
        console.error('Failed to delete message:', axiosError.response?.data || axiosError.message);
        throw error;
    }
};

// Загрузка аватара файлом с устройства
export const uploadAvatar = async (file: File): Promise<string> => {
    try {
        const formData = new FormData();
        formData.append('avatar', file);
        const { data } = await axiosInstance.post<{ avatar: string }>('/users/me/avatar', formData);
        return data.avatar;
    } catch (error: unknown) {
        const axiosError = error as AxiosError<{ message: string }>;
        console.error('Failed to upload avatar:', axiosError.response?.data || axiosError.message);
        throw error;
    }
};

// Отправка вложения в переписку (изображение/видео/голосовое/файл)
export const sendAttachment = async (userId: string, file: File): Promise<void> => {
    try {
        const formData = new FormData();
        formData.append('file', file);
        await axiosInstance.post(`/chats/${userId}/attachments`, formData);
    } catch (error: unknown) {
        const axiosError = error as AxiosError<{ message: string }>;
        console.error('Failed to send attachment:', axiosError.response?.data || axiosError.message);
        throw error;
    }
};

// Вложения переписки (галерея)
export const getChatMedia = async (userId: string): Promise<ChatAttachment[]> => {
    try {
        const { data } = await axiosInstance.get<{ media: MediaItemDto[] }>(`/chats/${userId}/media`);
        return data.media.map((m) => ({
            _id: m._id,
            type: m.type,
            url: m.url,
            mine: !!m.mine,
            createdAt: m.createdAt
        }));
    } catch (error: unknown) {
        const axiosError = error as AxiosError<{ message: string }>;
        console.error('Failed to fetch chat media:', axiosError.response?.data || axiosError.message);
        return [];
    }
};

// Закрепить/открепить чат
export const pinChat = async (userId: string, pinned: boolean): Promise<void> => {
    try {
        await axiosInstance.post(`/chats/${userId}/pin`, { pinned });
    } catch (error: unknown) {
        const axiosError = error as AxiosError<{ message: string }>;
        console.error('Failed to pin chat:', axiosError.response?.data || axiosError.message);
        throw error;
    }
};

// Новый порядок закреплённых чатов
export const reorderPins = async (order: string[]): Promise<void> => {
    try {
        await axiosInstance.post('/users/me/pins/reorder', { order });
    } catch (error: unknown) {
        const axiosError = error as AxiosError<{ message: string }>;
        console.error('Failed to reorder pins:', axiosError.response?.data || axiosError.message);
        throw error;
    }
};

// Удаление чата: для себя / для всех
export const deleteChat = async (userId: string, mode: 'self' | 'all'): Promise<void> => {
    try {
        await axiosInstance.delete(`/chats/${userId}`, { params: { mode } });
    } catch (error: unknown) {
        const axiosError = error as AxiosError<{ message: string }>;
        console.error('Failed to delete chat:', axiosError.response?.data || axiosError.message);
        throw error;
    }
};

// Клиентские настройки интерфейса (сохраняются в аккаунте)
export const saveUiSettings = async (settings: Record<string, unknown>): Promise<void> => {
    try {
        await axiosInstance.put('/users/me/settings', settings);
    } catch (error: unknown) {
        const axiosError = error as AxiosError<{ message: string }>;
        console.error('Failed to save ui settings:', axiosError.response?.data || axiosError.message);
    }
};

// Закреплённые сообщения переписки
export const getPinnedMessages = async (userId: string): Promise<ChatMessage[]> => {
    try {
        const { data } = await axiosInstance.get<{ pinned: MessageDto[] }>(`/chats/${userId}/pinned-messages`);
        return (data.pinned || []).map((msg) => ({
            id: msg._id,
            text: msg.payload?.payload ?? '',
            mine: !!msg.mine,
            readAt: msg.readAt ?? null,
            type: msg.type ?? 'text',
            replyTo: msg.replyTo ?? null,
            forwardedFrom: msg.forwardedFrom ?? null,
            createdAt: msg.createdAt
        }));
    } catch (error: unknown) {
        const axiosError = error as AxiosError<{ message: string }>;
        console.error('Failed to fetch pinned messages:', axiosError.response?.data || axiosError.message);
        return [];
    }
};

// Закрепить сообщение
export const pinMessage = async (userId: string, messageId: string): Promise<void> => {
    try {
        await axiosInstance.post(`/chats/${userId}/messages/${messageId}/pin`);
    } catch (error: unknown) {
        const axiosError = error as AxiosError<{ message: string }>;
        console.error('Failed to pin message:', axiosError.response?.data || axiosError.message);
        throw error;
    }
};

// Открепить сообщение
export const unpinMessage = async (userId: string, messageId: string): Promise<void> => {
    try {
        await axiosInstance.delete(`/chats/${userId}/messages/${messageId}/pin`);
    } catch (error: unknown) {
        const axiosError = error as AxiosError<{ message: string }>;
        console.error('Failed to unpin message:', axiosError.response?.data || axiosError.message);
        throw error;
    }
};
