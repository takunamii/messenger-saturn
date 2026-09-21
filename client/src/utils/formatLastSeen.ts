const ONLINE_WINDOW_MS = 60 * 1000;

// «онлайн» — активность за последнюю минуту; далее «был(а) …»
export function isUserOnline(lastSeenAt?: string | null): boolean {
    if (!lastSeenAt) return false;
    return Date.now() - new Date(lastSeenAt).getTime() <= ONLINE_WINDOW_MS;
}

export function formatLastSeen(lastSeenAt?: string | null): string {
    if (!lastSeenAt) return 'offline';

    const diffMs = Date.now() - new Date(lastSeenAt).getTime();
    if (diffMs <= ONLINE_WINDOW_MS) return 'онлайн';

    const min = Math.floor(diffMs / 60000);
    if (min < 5) return 'был(а) только что';
    if (min < 60) return `был(а) ${min} мин назад`;

    const hours = Math.floor(min / 60);
    if (hours < 24) return `был(а) ${hours} ч назад`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `был(а) ${days} дн назад`;

    return 'был(а) давно';
}

// Время последнего сообщения в списке чатов: сегодня — HH:MM, вчера — «вчера», иначе дата
export function formatChatTime(iso: string): string {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const time = date.getTime();

    if (time >= startOfToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (time >= startOfToday - 86400000) return 'вчера';

    return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
}
