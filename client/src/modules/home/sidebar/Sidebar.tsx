import * as React from 'react';
import UserSearch from './usersearch/UserSearch';
import ChatList from './chatlist/ChatList';
import Profile from './profile/Profile';
import { getChats, searchUsers, pinChat, reorderPins, deleteChat } from './usersearch/api/api';
import { useDebounce } from 'use-debounce';
import SaturnLogo from '../../../components/SaturnLogo';
import Avatar from '../../../components/Avatar';
import DeleteConfirmModal from '../../../components/DeleteConfirmModal';
import ChatContextMenu from '../../../components/ChatContextMenu';
import { isUserOnline } from '../../../utils/formatLastSeen';
import { useSocketEvents, useSocketStatus } from '../../../utils/socket';
import { useLongPress } from '../../../utils/longPress';

export interface Chat {
    id: string;
    name: string;
    lastMessage: string;
    lastMessageAt?: string | null;
    unreadCount?: number;
    lastSeenAt?: string | null;
    avatar?: string;
    pinned?: boolean;
}

export interface User {
    id: string;
    name: string;
}

// Аватарка чата в свернутом режиме: клик — открыть, долгое нажатие — меню
const CollapsedChatButton: React.FC<{
    chat: Chat;
    selected: boolean;
    online: boolean;
    onSelect: () => void;
    onMenu: (chat: Chat, pos: { x: number; y: number }) => void;
}> = ({ chat, selected, online, onSelect, onMenu }) => {
    const longPress = useLongPress((pos) => onMenu(chat, pos));
    return (
        <button
            onClick={() => { if (longPress.didFire()) return; onSelect(); }}
            onContextMenu={(e) => { e.preventDefault(); onMenu(chat, { x: e.clientX, y: e.clientY }); }}
            {...longPress}
            style={{ WebkitTouchCallout: 'none' }}
            className={`relative w-11 h-11 mb-1.5 mx-auto rounded-full focus:outline-none transition-transform active:scale-95 block ${selected ? 'ring-2 ring-[#5865F2]' : 'hover:ring-2 hover:ring-white/20'}`}
            title={chat.name}
            aria-label={`Открыть чат с ${chat.name}`}
        >
            <Avatar name={chat.name} src={chat.avatar || undefined} size={44} />
            {online && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-[#17212b]" />
            )}
            {(chat.unreadCount ?? 0) > 0 && (
                <span
                    className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 flex items-center justify-center bg-gradient-to-br from-[#6d7cf6] to-[#4752c4] text-white text-[9px] font-semibold rounded-full border-2 border-[#17212b]"
                    title={`${chat.unreadCount} непрочитанных`}
                >
                    {chat.unreadCount! > 9 ? '9+' : chat.unreadCount}
                </span>
            )}
            {chat.pinned && (
                <span className="absolute -top-1 -left-1 w-3.5 h-3.5 flex items-center justify-center bg-[#222d3d] rounded-full border border-white/10" title="Закреплён">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" className="text-[#8ea1ff]">
                        <path d="m12 22 1-2v-3h5a1 1 0 0 0 1-1v-1.586c0-.526-.214-1.042-.586-1.414L17 11.586V8a1 1 0 0 0 1-1V4c0-1.103-.897-2-2-2H8c-1.103 0-2 .897-2 2v3a1 1 0 0 0 1 1v3.586L5.586 13A2.01 2.01 0 0 0 5 14.414V16a1 1 0 0 0 1 1h5v3l1 2zM8 4h8v2H8V4zM7 14.414l1.707-1.707A.996.996 0 0 0 9 12V8h6v4c0 .266.105.52.293.707L17 14.414V15H7v-.586z" />
                    </svg>
                </span>
            )}
        </button>
    );
};

const Sidebar: React.FC<{
    onSelectChat: (id: string, name?: string) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    selectedChatId?: string | null;
    onRegisterRefresh?: (refresh: () => void) => void;
    collapsed: boolean;
}> = ({ onSelectChat, searchQuery, setSearchQuery, selectedChatId, onRegisterRefresh, collapsed }) => {
    const [chats, setChats] = React.useState<Chat[]>([]);
    const [allUsers, setAllUsers] = React.useState<User[]>([]);
    const [debouncedSearchQuery] = useDebounce(searchQuery, 300);
    // актуальный список онлайн-пользователей (по WS presence) — статусы в списке чатов
    const [onlineIds, setOnlineIds] = React.useState<Set<string>>(new Set());

    const refreshChats = React.useCallback(async () => {
        try {
            const fetchedChats = await getChats();
            setChats(fetchedChats);
        } catch (error) {
            console.error('Failed to fetch chats:', error);
        }
    }, []);

    const refreshTimerRef = React.useRef<number | null>(null);
    const wsConnected = useSocketStatus();
    const refreshChatsSoon = React.useCallback(() => {
        if (refreshTimerRef.current) return;
        refreshTimerRef.current = window.setTimeout(() => {
            refreshTimerRef.current = null;
            refreshChats();
        }, 200);
    }, [refreshChats]);

    React.useEffect(() => {
        refreshChats();
        // WS подключён — редкий страховочный поллинг; нет WS — чаще
        const period = wsConnected ? 60000 : 10000;
        const timer = setInterval(refreshChats, period);
        return () => {
            clearInterval(timer);
            if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
        };
    }, [refreshChats, wsConnected]);

    // realtime: список чатов обновляется мгновенно по WS-событиям
    const humanizeType = (type?: string, text?: string) => {        switch (type) {
            case 'image': return 'Изображение';
            case 'video': return 'Видеофайл';
            case 'audio': return 'Голосовое сообщение';
            case 'file': return 'Файл';
            default: return text || 'No messages yet';
        }
    };

    useSocketEvents((event) => {
        switch (event.type) {
            case 'message:new': {
                // локальное обновление строки чата — без запроса к серверу
                const m = event.message;
                const pid = event.partnerId;
                if (!pid) { refreshChatsSoon(); break; }
                const incoming = m.senderId === pid;
                const updatedAt = m.createdAt || new Date().toISOString();
                setChats((prev) => {
                    const idx = prev.findIndex((c) => c.id === pid);
                    if (idx === -1) {
                        refreshChatsSoon(); // новый чат — подтягиваем целиком
                        return prev;
                    }
                    const chat = prev[idx];
                    const unread = chat.unreadCount ?? 0;
                    const updated: Chat = {
                        ...chat,
                        lastMessage: humanizeType(m.type, m.payload?.payload),
                        lastMessageAt: updatedAt,
                        unreadCount: incoming && pid !== selectedChatId ? unread + 1 : unread,
                    };
                    const next = prev.slice();
                    next[idx] = updated;
                    const pinnedChats = next.filter((c) => c.pinned);
                    const rest = next
                        .filter((c) => !c.pinned)
                        .sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''));
                    return [...pinnedChats, ...rest];
                });
                break;
            }
            case 'chat:deleted': {
                if (event.mode === 'all' && event.partnerId) {
                    // чат удалён у обоих — убираем локально
                    setChats((prev) => prev.filter((c) => c.id !== event.partnerId));
                } else {
                    refreshChatsSoon();
                }
                break;
            }
            case 'presence:init': {
                setOnlineIds(new Set(event.online));
                break;
            }
            case 'presence': {
                const at = event.online ? new Date().toISOString() : event.at;
                setChats((prev) => prev.map((c) => (c.id === event.userId ? { ...c, lastSeenAt: at } : c)));
                setOnlineIds((prev) => {
                    const next = new Set(prev);
                    if (event.online) next.add(event.userId);
                    else next.delete(event.userId);
                    return next;
                });
                break;
            }
            default:
                break;
        }
    });

    // открытый чат — непрочитанных больше нет
    React.useEffect(() => {
        if (!selectedChatId) return;
        setChats((prev) => prev.map((c) => (c.id === selectedChatId ? { ...c, unreadCount: 0 } : c)));
    }, [selectedChatId]);

    // регистрируем мгновенное обновление списка (после отправки сообщения)
    React.useEffect(() => {
        onRegisterRefresh?.(refreshChats);
        return () => onRegisterRefresh?.(() => {});
    }, [refreshChats, onRegisterRefresh]);

    React.useEffect(() => {
        (async () => {
            if (debouncedSearchQuery && debouncedSearchQuery.length >= 3) {
                try {
                    const fetchedUsers = await searchUsers(debouncedSearchQuery);
                    setAllUsers(fetchedUsers);
                } catch (error) {
                    console.error('Failed to fetch users:', error);
                }
            } else {
                setAllUsers([]);
            }
        })();
    }, [debouncedSearchQuery]);

    const handleSelectChat = (id: string, name?: string) => {
        onSelectChat(id, name);
    };

    const handleTogglePin = async (chat: Chat) => {
        try {
            await pinChat(chat.id, !chat.pinned);
            await refreshChats();
        } catch (e) {
            console.error(e);
        }
    };

    const handleDeleteChat = async (chat: Chat, mode: 'self' | 'all') => {
        try {
            await deleteChat(chat.id, mode);
            await refreshChats();
        } catch (e) {
            console.error(e);
        }
    };

    const [chatToDelete, setChatToDelete] = React.useState<Chat | null>(null);
    const [collapsedMenu, setCollapsedMenu] = React.useState<{ chat: Chat; x: number; y: number } | null>(null);

    const handleReorderPins = async (order: string[]) => {
        // оптимистично меняем локальный порядок, затем сохраняем на сервере
        setChats(prev => {
            const pinnedChats = order.map(id => prev.find(c => c.id === id)).filter(Boolean) as Chat[];
            const rest = prev.filter(c => !order.includes(c.id));
            return [...pinnedChats, ...rest];
        });
        try {
            await reorderPins(order);
        } catch (e) {
            console.error(e);
        }
        refreshChats();
    };

    if (collapsed) {
        // Свернутый режим: только аватарки чатов + непрочитанные + профиль
        return (
            <div className="w-full h-dvh bg-[#17212b] flex flex-col relative border-r border-black/30">
                <div className="h-[60px] flex items-center justify-center shrink-0">
                    <SaturnLogo size={36} />
                </div>
                <div className="flex-1 overflow-y-auto px-2 pt-1 pb-2">
                    {chats.map(chat => (
                        <CollapsedChatButton
                            key={chat.id}
                            chat={chat}
                            selected={chat.id === selectedChatId}
                            online={onlineIds.has(chat.id) || (!wsConnected && isUserOnline(chat.lastSeenAt))}
                            onSelect={() => onSelectChat(chat.id, chat.name)}
                            onMenu={(c, pos) => setCollapsedMenu({ chat: c, x: pos.x, y: pos.y })}
                        />
                    ))}
                </div>
                <div className="shrink-0 p-2 flex justify-center">
                    <Profile compact />
                </div>

                <ChatContextMenu
                    menu={collapsedMenu ? { id: collapsedMenu.chat.id, name: collapsedMenu.chat.name, pinned: !!collapsedMenu.chat.pinned, x: collapsedMenu.x, y: collapsedMenu.y } : null}
                    onClose={() => setCollapsedMenu(null)}
                    onTogglePin={async (id, pinned) => {
                        await pinChat(id, pinned);
                        refreshChats();
                    }}
                    onDeletePrompt={(id, name) => {
                        const chat = chats.find(c => c.id === id);
                        setChatToDelete(chat || ({ id, name, lastMessage: '' } as Chat));
                    }}
                />

                <DeleteConfirmModal
                    open={!!chatToDelete}
                    title="Удалить чат?"
                    subtitle={chatToDelete?.name}
                    onClose={() => setChatToDelete(null)}
                    onDelete={(mode) => {
                        if (chatToDelete) handleDeleteChat(chatToDelete, mode);
                        setChatToDelete(null);
                    }}
                />
            </div>
        );
    }

    return (
        <div className="w-full h-dvh bg-[#17212b] flex flex-col relative border-r border-black/30">
            {/* Header */}
            <div className="h-[60px] px-4 flex items-center gap-2.5 shrink-0">
                <SaturnLogo size={40} />
                <h1 className="text-white text-lg font-bold tracking-wide">Saturn</h1>
            </div>
            <UserSearch searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
            <ChatList
                chats={chats}
                allUsers={allUsers}
                onSelectChat={handleSelectChat}
                searchQuery={searchQuery}
                selectedChatId={selectedChatId}
                onTogglePin={handleTogglePin}
                onDeleteChatPrompt={setChatToDelete}
                onReorderPins={handleReorderPins}
                onlineIds={onlineIds}
                wsConnected={wsConnected}
            />
            <div className="mt-auto shrink-0">
                <Profile compact={false} />
            </div>

            <DeleteConfirmModal
                open={!!chatToDelete}
                title="Удалить чат?"
                subtitle={chatToDelete?.name}
                onClose={() => setChatToDelete(null)}
                onDelete={(mode) => {
                    if (chatToDelete) handleDeleteChat(chatToDelete, mode);
                    setChatToDelete(null);
                }}
            />
        </div>
    );
};

export default Sidebar;
