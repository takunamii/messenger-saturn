import * as React from 'react';

export interface LongPressHandlers {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
    onTouchCancel: () => void;
    /** true, если long-press только что сработал — клик после него нужно игнорировать */
    didFire: () => boolean;
}

// Долгое нажатие на тач-устройствах: имитация правой кнопки мыши.
// Отмена при движении пальца больше ~10px (это скролл) или отпускании.
export function useLongPress(onLongPress: (pos: { x: number; y: number }) => void, ms = 500): LongPressHandlers {
    const timerRef = React.useRef<number | null>(null);
    const startPosRef = React.useRef({ x: 0, y: 0 });
    const firedRef = React.useRef(false);

    const clear = React.useCallback(() => {
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const handlers = React.useMemo<LongPressHandlers>(() => ({
        onTouchStart: (e) => {
            const t = e.touches[0];
            if (!t) return;
            firedRef.current = false;
            startPosRef.current = { x: t.clientX, y: t.clientY };
            const x = t.clientX;
            const y = t.clientY;
            clear();
            timerRef.current = window.setTimeout(() => {
                timerRef.current = null;
                firedRef.current = true;
                if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                    try { navigator.vibrate?.(20); } catch { /* игнорируем */ }
                }
                onLongPress({ x, y });
            }, ms);
        },
        onTouchMove: (e) => {
            const t = e.touches[0];
            if (!t) return;
            const dx = t.clientX - startPosRef.current.x;
            const dy = t.clientY - startPosRef.current.y;
            if (dx * dx + dy * dy > 144) clear(); // сдвиг > ~12px — это скролл, отменяем
        },
        onTouchEnd: clear,
        onTouchCancel: clear,
        didFire: () => firedRef.current,
    }), [onLongPress, ms, clear]);

    return handlers;
}
