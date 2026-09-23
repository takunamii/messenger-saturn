import * as React from 'react';
import { createPortal } from 'react-dom';

interface ChatContextMenuProps {
    menu: { id: string; name: string; pinned: boolean; x: number; y: number } | null;
    onClose: () => void;
    onTogglePin: (chatId: string, pinned: boolean) => void;
    onDeletePrompt: (chatId: string, name: string) => void;
}

const ChatContextMenu: React.FC<ChatContextMenuProps> = ({ menu, onClose, onTogglePin, onDeletePrompt }) => {
    const menuRef = React.useRef<HTMLDivElement>(null);
    const openedAtRef = React.useRef(0);

    React.useEffect(() => {
        if (!menu) return;
        openedAtRef.current = Date.now();
        const onDocMouseDown = (e: MouseEvent) => {
            // на тач-устройствах после long-press приходит синтетический клик — игнорируем
            if (Date.now() - openedAtRef.current < 500) return;
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
        };
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('mousedown', onDocMouseDown);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('mousedown', onDocMouseDown);
            window.removeEventListener('keydown', onKey);
        };
    }, [menu, onClose]);

    if (!menu) return null;

    const itemCls = 'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white hover:bg-[#5865F2]/80 transition-colors text-left';

    return createPortal(
        <div
            ref={menuRef}
            className="fixed z-[80] min-w-[190px] bg-[#1c2530] border border-white/10 rounded-xl shadow-2xl shadow-black/50 py-1.5 overflow-hidden"
            style={{ left: Math.min(menu.x, window.innerWidth - 200), top: Math.min(menu.y, window.innerHeight - 140) }}
            onContextMenu={(e) => e.preventDefault()}
        >
            <button
                className={itemCls}
                onClick={() => { onTogglePin(menu.id, !menu.pinned); onClose(); }}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className={menu.pinned ? 'text-[#8ea1ff]' : ''}>
                    <path d="m12 22 1-2v-3h5a1 1 0 0 0 1-1v-1.586c0-.526-.214-1.042-.586-1.414L17 11.586V8a1 1 0 0 0 1-1V4c0-1.103-.897-2-2-2H8c-1.103 0-2 .897-2 2v3a1 1 0 0 0 1 1v3.586L5.586 13A2.01 2.01 0 0 0 5 14.414V16a1 1 0 0 0 1 1h5v3l1 2zM8 4h8v2H8V4zM7 14.414l1.707-1.707A.996.996 0 0 0 9 12V8h6v4c0 .266.105.52.293.707L17 14.414V15H7v-.586z" />
                </svg>
                {menu.pinned ? 'Открепить чат' : 'Закрепить чат'}
            </button>
            <button
                className={`${itemCls} hover:bg-red-500/80`}
                onClick={() => { onDeletePrompt(menu.id, menu.name); onClose(); }}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Удалить чат
            </button>
        </div>,
        document.body
    );
};

export default ChatContextMenu;
