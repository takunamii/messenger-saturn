import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './sidebar/Sidebar';
import ChatArea from './chatarea/ChatArea';
import { getProfile } from './sidebar/profile/api/api';
import { saveUiSettings } from './sidebar/usersearch/api/api';

const SIDEBAR_MIN = 260;
const SIDEBAR_MAX = 520;
const SIDEBAR_DEFAULT = 340;
const SIDEBAR_COLLAPSE_THRESHOLD = 180; // тянем ручку левее — сайдбар сворачивается
const SIDEBAR_KEY = 'saturn-sidebar-width';

function loadSidebarWidth(): number {
    const saved = Number(localStorage.getItem(SIDEBAR_KEY));
    return saved >= SIDEBAR_MIN && saved <= SIDEBAR_MAX ? saved : SIDEBAR_DEFAULT;
}

const Home: React.FC = () => {
    const [selectedChat, setSelectedChat] = React.useState<{ id: string; name: string } | null>(null);
    const [searchQuery, setSearchQuery] = React.useState<string>('');
    const [sidebarWidth, setSidebarWidth] = React.useState(loadSidebarWidth);
    const [sidebarCollapsed, setSidebarCollapsed] = React.useState(() => localStorage.getItem('saturn-sidebar-collapsed') === '1');
    const sidebarCollapsedRef = React.useRef(sidebarCollapsed);
    sidebarCollapsedRef.current = sidebarCollapsed;
    const navigate = useNavigate();

    // ширина и свернутость хранятся в аккаунте (одинаковы на всех устройствах/аккаунтах)
    React.useEffect(() => {
        if (!localStorage.getItem('token')) return;
        getProfile()
            .then((p) => {
                const st = p.settings || {};
                if (typeof st.sidebarWidth === 'number' && st.sidebarWidth >= SIDEBAR_MIN && st.sidebarWidth <= SIDEBAR_MAX) {
                    setSidebarWidth(st.sidebarWidth);
                }
                if (typeof st.sidebarCollapsed === 'boolean') {
                    setSidebarCollapsed(st.sidebarCollapsed);
                    sidebarCollapsedRef.current = st.sidebarCollapsed;
                }
            })
            .catch(() => {});
    }, [navigate]);

    React.useEffect(() => {
        if (!localStorage.getItem('token')) {
            navigate('/login', { replace: true });
        }
    }, [navigate]);

    const handleSelectChat = (id: string, name?: string) => {
        setSelectedChat({ id, name: name || 'Chat' });
    };

    const refreshChatsRef = React.useRef<() => void>(() => {});
    const registerRefresh = React.useCallback((refresh: () => void) => {
        refreshChatsRef.current = refresh;
    }, []);

    const handleSendMessage = async () => {
        // Сообщение уже отправлено в ChatArea — здесь только мгновенно обновляем список чатов
        refreshChatsRef.current?.();
    };

    // Растягивание мышью: при сужении ниже порога сайдбар сворачивается, при оттягивании — разворачивается
    const resizingRef = React.useRef(false);

    const handleResizeStart = (e: React.MouseEvent) => {
        e.preventDefault();
        resizingRef.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const onMove = (ev: MouseEvent) => {
            if (ev.clientX < SIDEBAR_COLLAPSE_THRESHOLD) {
                if (!sidebarCollapsedRef.current) {
                    setSidebarCollapsed(true);
                    sidebarCollapsedRef.current = true;
                    saveUiSettings({ sidebarCollapsed: true });
                }
            } else {
                if (sidebarCollapsedRef.current) {
                    setSidebarCollapsed(false);
                    sidebarCollapsedRef.current = false;
                    saveUiSettings({ sidebarCollapsed: false });
                }
                setSidebarWidth(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, ev.clientX)));
            }
        };
        const onUp = () => {
            resizingRef.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            setSidebarWidth(w => {
                localStorage.setItem(SIDEBAR_KEY, String(w));
                saveUiSettings({ sidebarWidth: w });
                return w;
            });
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    return (
        <div className="h-dvh bg-[#0e1621] flex overflow-hidden" style={{ '--sidebar-w': `${sidebarWidth}px` } as React.CSSProperties}>
            {/* Sidebar — на мобильных скрывается, когда открыт чат; на десктопе растягивается и сворачивается */}
            <div
                className={`${selectedChat ? 'hidden' : 'block'} ${sidebarCollapsed ? 'md:w-[68px]' : 'md:w-[var(--sidebar-w)]'} w-full shrink-0 h-dvh relative md:block`}
            >
                <Sidebar
                    onSelectChat={handleSelectChat}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    selectedChatId={selectedChat?.id ?? null}
                    onRegisterRefresh={registerRefresh}
                    collapsed={sidebarCollapsed}
                />
                {/* Ручка растягивания/сворачивания (десктоп) */}
                <div
                    onMouseDown={handleResizeStart}
                    className="hidden md:block absolute top-0 right-0 h-full w-[7px] cursor-col-resize z-20 hover:bg-[#5865F2]/40 transition-colors"
                    title="Потяните, чтобы изменить ширину (сильнее влево — свернуть)"
                />
            </div>
            {/* Chat Area — на мобильных показывается только когда выбран чат */}
            <div className={`${selectedChat ? 'block' : 'hidden'} flex-1 min-w-0 h-dvh md:block`}>
                <ChatArea
                    selectedChatId={selectedChat?.id ?? null}
                    chatName={selectedChat?.name ?? 'Chat'}
                    onSendMessage={handleSendMessage}
                    onBack={() => setSelectedChat(null)}
                    onSelectChat={handleSelectChat}
                />
            </div>
        </div>
    );
};

export default Home;
