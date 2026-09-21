import * as React from 'react';

// сообщение с сервера (форма DTO эндпоинтов /chats)
export interface ServerMessage {
    _id: string;
    senderId: string;
    recipientId: string;
    type: string;
    payload: { type?: string; payload?: string };
    replyTo?: { id: string; senderId: string; text: string; type: string } | null;
    forwardedFrom?: { id: string; displayName: string } | null;
    readAt?: string | null;
    createdAt: string;
}

export type WsEvent =
    | { type: 'message:new'; message: ServerMessage; partnerId?: string; chatId?: string }
    | { type: 'messages:read'; chatId: string; at: string }
    | { type: 'message:deleted'; chatId: string; messageId: string; mode: 'self' | 'all'; partnerId?: string }
    | { type: 'message:pinned'; chatId: string; messageId: string; pinned: boolean; partnerId?: string }
    | { type: 'chat:deleted'; chatId: string; mode: 'self' | 'all'; partnerId?: string }
    | { type: 'presence'; userId: string; online: boolean; at: string }
    | { type: 'presence:init'; online: string[] }
    | { type: 'typing'; from: string; typing: boolean; kind?: 'typing' | 'recording' };

type Listener = (event: WsEvent) => void;

const WS_URL: string =
    (import.meta.env?.VITE_WS_URL as string) ||
    (() => {
        // по умолчанию — тот же хост, что и страница (или дев-сервер :3000)
        if (import.meta.env.DEV) return 'ws://localhost:3000/ws';
        const { protocol, host } = window.location;
        return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}/ws`;
    })();

class SocketClient {
    private ws: WebSocket | null = null;
    private listeners = new Set<Listener>();
    private statusListeners = new Set<(connected: boolean) => void>();
    private reconnectTimer: number | null = null;
    private reconnectDelay = 1000;
    private closedByUser = false;
    private onlineSet = new Set<string>();

    private emitStatus(connected: boolean) {
        for (const l of [...this.statusListeners]) l(connected);
    }

    private hasToken() {
        return !!localStorage.getItem('token');
    }

    connect() {
        if (!this.hasToken() || this.ws) return;
        const token = localStorage.getItem('token')!;
        try {
            const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
            this.ws = ws;

            ws.onopen = () => {
                this.reconnectDelay = 1000;
                this.emitStatus(true);
            };

            ws.onmessage = (e) => {
                let event: WsEvent;
                try {
                    event = JSON.parse(e.data);
                } catch {
                    return;
                }
                if (event.type === 'presence:init') {
                    this.onlineSet = new Set(event.online);
                } else if (event.type === 'presence') {
                    if (event.online) this.onlineSet.add(event.userId);
                    else this.onlineSet.delete(event.userId);
                }
                for (const l of [...this.listeners]) l(event);
            };

            ws.onclose = (e) => {
                this.ws = null;
                this.emitStatus(false);
                if (this.closedByUser || e.code === 4001) return;
                // авто-реконнект с нарастающей задержкой
                this.reconnectTimer = window.setTimeout(() => this.connect(), this.reconnectDelay);
                this.reconnectDelay = Math.min(this.reconnectDelay * 2, 15000);
            };

            ws.onerror = () => {
                ws.close();
            };
        } catch {
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect() {
        if (this.reconnectTimer) return;
        this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, this.reconnectDelay);
    }

    disconnect() {
        this.closedByUser = true;
        if (this.reconnectTimer) {
            window.clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.ws?.close();
        this.ws = null;
    }

    send(data: unknown) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
            return true;
        }
        return false;
    }

    subscribe(listener: Listener) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    onStatus(listener: (connected: boolean) => void) {
        this.statusListeners.add(listener);
        return () => {
            this.statusListeners.delete(listener);
        };
    }

    isConnected() {
        return !!this.ws && this.ws.readyState === WebSocket.OPEN;
    }

    isUserOnline(userId: string) {
        return this.onlineSet.has(userId);
    }
}

export const socket = new SocketClient();

// Хук: подписка на все WS-события
export function useSocketEvents(handler: (event: WsEvent) => void) {
    const saved = React.useRef(handler);
    saved.current = handler;
    React.useEffect(() => {
        return socket.subscribe((e) => saved.current(e));
    }, []);
}

// Хук статуса соединения
export function useSocketStatus() {
    const [connected, setConnected] = React.useState(socket.isConnected());
    React.useEffect(() => socket.onStatus(setConnected), []);
    return connected;
}

// Хук: онлайн-статус пользователя (по presence)
export function useUserOnline(userId?: string | null) {
    const [online, setOnline] = React.useState(() => (userId ? socket.isUserOnline(userId) : false));
    useSocketEvents((e) => {
        if (!userId) return;
        if (e.type === 'presence:init') setOnline(e.online.includes(userId));
        else if (e.type === 'presence' && e.userId === userId) setOnline(e.online);
    });
    React.useEffect(() => {
        setOnline(userId ? socket.isUserOnline(userId) : false);
    }, [userId]);
    return online;
}
