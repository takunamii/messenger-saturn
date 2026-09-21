import * as React from 'react';
import type { Chat, User } from '../Sidebar';
import Avatar from '../../../../components/Avatar';
import ChatContextMenu from '../../../../components/ChatContextMenu';
import { isUserOnline, formatChatTime } from '../../../../utils/formatLastSeen';

// иконка «закреплено» (Boxicons pin)
const PinIcon: React.FC<{ className?: string; title?: string; size?: number }> = ({ className = '', title, size = 12 }) => (
    <span className={className} title={title}>
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
            <path d="m12 22 1-2v-3h5a1 1 0 0 0 1-1v-1.586c0-.526-.214-1.042-.586-1.414L17 11.586V8a1 1 0 0 0 1-1V4c0-1.103-.897-2-2-2H8c-1.103 0-2 .897-2 2v3a1 1 0 0 0 1 1v3.586L5.586 13A2.01 2.01 0 0 0 5 14.414V16a1 1 0 0 0 1 1h5v3l1 2zM8 4h8v2H8V4zM7 14.414l1.707-1.707A.996.996 0 0 0 9 12V8h6v4c0 .266.105.52.293.707L17 14.414V15H7v-.586z" />
        </svg>
    </span>
);

interface ChatListProps {
    chats: Chat[];
    allUsers: User[];
    onSelectChat: (id: string, name?: string) => void;
    searchQuery: string;
    selectedChatId?: string | null;
    onTogglePin?: (chat: Chat) => void;
    onDeleteChatPrompt?: (chat: Chat) => void;
    onReorderPins?: (order: string[]) => void;
}

const ChatList: React.FC<ChatListProps> = ({ chats, allUsers, onSelectChat, searchQuery, selectedChatId, onTogglePin, onDeleteChatPrompt, onReorderPins }) => {
    const [menu, setMenu] = React.useState<{ chat: Chat; x: number; y: number } | null>(null);
    const [dragId, setDragId] = React.useState<string | null>(null);

    // Фильтрация существующих чатов по поисковому запросу (по name)
    const filteredChats = searchQuery
        ? chats.filter(chat =>
            chat.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : chats;

    // Фильтрация новых пользователей, исключая тех, кто уже в чатах
    const filteredUsers = searchQuery
        ? allUsers.filter(user =>
            !chats.some(chat => chat.id === user.id) &&
            user.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : [];

    const pinned = filteredChats.filter(c => c.pinned);
    const unpinned = filteredChats.filter(c => !c.pinned);

    // меню закрывает сам ChatContextMenu (он знает про портал), здесь слушатели не нужны

    const chatRowCls = (active: boolean) =>
        `group flex items-center gap-3 p-2.5 mb-1 rounded-xl cursor-pointer transition-colors ${
            active ? 'bg-[#5865F2] text-white' : 'hover:bg-white/5'
        }`;

    const Row: React.FC<{ chat: Chat; draggable: boolean }> = ({ chat, draggable }) => (
        <div
            onClick={() => onSelectChat(chat.id, chat.name)}
            onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenu({ chat, x: e.clientX, y: e.clientY });
            }}
            draggable={draggable}
            onDragStart={(e) => {
                if (!draggable) return;
                setDragId(chat.id);
                e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
                if (!draggable || !dragId || dragId === chat.id) return;
                e.preventDefault();
            }}
            onDrop={(e) => {
                e.preventDefault();
                if (!draggable || !dragId || dragId === chat.id || !onReorderPins) return;
                const order = pinned.filter(c => c.id !== dragId).map(c => c.id);
                const targetIdx = pinned.findIndex(c => c.id === chat.id);
                const fromIdx = order.length;
                order.splice(targetIdx < 0 ? order.length : targetIdx, 0, dragId);
                void fromIdx;
                onReorderPins(order);
                setDragId(null);
            }}
            onDragEnd={() => setDragId(null)}
            className={`${chatRowCls(chat.id === selectedChatId)} ${dragId === chat.id ? 'opacity-40' : ''}`}
        >
            <div className="relative shrink-0">
                <Avatar name={chat.name} src={chat.avatar || undefined} size={46} />
                {isUserOnline(chat.lastSeenAt) && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-[#17212b]" title="онлайн" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-white flex items-center gap-1.5">
                    {chat.pinned && (
                        <PinIcon className="text-[#8ea1ff] shrink-0 flex" title="Закреплён" />
                    )}
                    <span className="truncate selectable">{chat.name}</span>
                </p>
                <p className={`text-xs truncate ${chat.id === selectedChatId ? 'text-white/70' : 'text-[#8f9aa7]'}`}>
                    {chat.lastMessage}
                </p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0 self-center">
                <button
                    onClick={(e) => { e.stopPropagation(); onTogglePin?.(chat); }}
                    className={`w-6 h-6 -mr-1 flex items-center justify-center rounded-full transition-all ${
                        chat.pinned
                            ? 'text-[#8ea1ff] opacity-100'
                            : 'text-[#8f9aa7] opacity-0 group-hover:opacity-100 hover:bg-white/10'
                    }`}
                    title={chat.pinned ? 'Открепить чат' : 'Закрепить чат'}
                    aria-label={chat.pinned ? 'Открепить чат' : 'Закрепить чат'}
                >
                    <PinIcon size={14} />
                </button>
                {chat.lastMessageAt && (
                    <span className={`text-[11px] ${chat.id === selectedChatId ? 'text-white/70' : 'text-[#8f9aa7]'}`}>
                        {formatChatTime(chat.lastMessageAt)}
                    </span>
                )}
                {(chat.unreadCount ?? 0) > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-[#f23f42] text-white text-[10px] font-bold rounded-full">
                        {chat.unreadCount! > 99 ? '99+' : chat.unreadCount}
                    </span>
                )}
            </div>
        </div>
    );

    return (
        <div className="flex-1 overflow-y-auto px-2 pt-1 pb-4">
            {/* Секция существующих чатов */}
            <div className="mb-3">
                {filteredChats.length > 0 ? (
                    <>
                        {pinned.length > 0 && (
                            <>
                                <h2 className="text-[#8f9aa7] text-[10px] font-semibold uppercase tracking-wider px-2.5 mb-1.5 mt-1">Закреплённые</h2>
                                {pinned.map(chat => <Row key={chat.id} chat={chat} draggable />)}
                            </>
                        )}
                        {unpinned.map(chat => <Row key={chat.id} chat={chat} draggable={false} />)}
                    </>
                ) : (
                    <div className="text-center py-10 px-4">
                        <div className="mx-auto w-14 h-14 rounded-full bg-white/5 flex items-center justify-center">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5d6b7b" strokeWidth="1.5" strokeLinecap="round">
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                            </svg>
                        </div>
                        <p className="text-[#8f9aa7] text-sm mt-3">
                            {searchQuery ? 'Ничего не найдено' : 'У вас пока нет чатов.'}
                        </p>
                        {!searchQuery && (
                            <p className="text-[#5d6b7b] text-xs mt-1">
                                Найдите пользователя через поиск выше
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Секция новых пользователей (только при поиске) */}
            {searchQuery && filteredUsers.length > 0 && (
                <div className="mb-2">
                    <h2 className="text-[#8f9aa7] text-[11px] font-semibold uppercase tracking-wider px-2.5 mb-1.5">
                        Новые пользователи
                    </h2>
                    {filteredUsers.map(user => (
                        <div
                            key={user.id}
                            onClick={() => onSelectChat(user.id, user.name)} // Открываем переписку с пользователем
                            className="flex items-center gap-3 p-2.5 mb-1 rounded-xl cursor-pointer hover:bg-white/5 transition-colors"
                        >
                            <Avatar name={user.name} size={46} />
                            <div className="flex-1 min-w-0">
                                <p className="text-white font-medium truncate">{user.name}</p>
                                <p className="text-xs text-[#8f9aa7] flex items-center gap-1">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                        <line x1="22" y1="2" x2="11" y2="13" />
                                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                    </svg>
                                    Начать переписку
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Контекстное меню чата */}
            <ChatContextMenu
                menu={menu ? { id: menu.chat.id, name: menu.chat.name, pinned: !!menu.chat.pinned, x: menu.x, y: menu.y } : null}
                onClose={() => setMenu(null)}
                onTogglePin={(id) => {
                    const chat = chats.find(c => c.id === id);
                    if (chat) onTogglePin?.(chat);
                }}
                onDeletePrompt={(id, name) => {
                    const chat = chats.find(c => c.id === id);
                    if (chat) onDeleteChatPrompt?.(chat);
                    void name;
                }}
            />
        </div>
    );
};

export default ChatList;
