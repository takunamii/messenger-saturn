import * as React from 'react';

// Детерминированная псевдо-волновая форма: высоты столбиков зависят от src,
// поэтому один и тот же файл всегда выглядит одинаково
function seedFrom(src: string): number {
    let h = 2166136261;
    for (let i = 0; i < src.length; i++) {
        h ^= src.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function mulberry32(seed: number) {
    let a = seed;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function buildBars(src: string, count: number): number[] {
    const rand = mulberry32(seedFrom(src));
    const bars: number[] = [];
    for (let i = 0; i < count; i++) {
        // форма «речи»: середина обычно громче краёв
        const envelope = 0.55 + 0.45 * Math.sin((Math.PI * i) / (count - 1));
        bars.push(Math.min(1, 0.22 + rand() * 0.78 * envelope));
    }
    return bars;
}

const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
};

const VoicePlayer: React.FC<{
    src: string;
    isMe?: boolean;
    compact?: boolean;
}> = ({ src, isMe = false, compact = false }) => {
    const audioRef = React.useRef<HTMLAudioElement | null>(null);
    const [playing, setPlaying] = React.useState(false);
    const [duration, setDuration] = React.useState(0);
    const [position, setPosition] = React.useState(0);

    const barCount = compact ? 26 : 32;
    const bars = React.useMemo(() => buildBars(src, barCount), [src, barCount]);

    const progress = duration > 0 ? Math.min(position / duration, 1) : 0;

    const handleLoadedMetadata = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (isFinite(audio.duration) && audio.duration > 0) {
            setDuration(audio.duration);
            return;
        }
        // записанные webm/ogg часто отдают Infinity — получаем длительность хаком с перемоткой
        const onTime = () => {
            audio.removeEventListener('timeupdate', onTime);
            if (isFinite(audio.duration) && audio.duration > 0) {
                setDuration(audio.duration);
            }
            audio.currentTime = 0;
        };
        audio.addEventListener('timeupdate', onTime);
        try {
            audio.currentTime = 1e101;
        } catch {
            audio.removeEventListener('timeupdate', onTime);
        }
    };

    const togglePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        const audio = audioRef.current;
        if (!audio) return;
        if (audio.paused) {
            audio.play().catch(() => {});
        } else {
            audio.pause();
        }
    };

    const seekFromEvent = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        const audio = audioRef.current;
        if (!audio || !isFinite(audio.duration) || audio.duration <= 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
        audio.currentTime = ratio * audio.duration;
        setPosition(audio.currentTime);
    };

    const filledCls = isMe ? 'bg-white' : 'bg-[#8ea1ff]';
    const emptyCls = isMe ? 'bg-white/25' : 'bg-white/20';

    return (
        <div
            className={`flex items-center gap-2.5 ${compact ? 'min-w-[180px]' : 'min-w-[200px] sm:min-w-[240px]'}`}
            onClick={(e) => e.stopPropagation()}
        >
            <audio
                ref={audioRef}
                src={src}
                preload="metadata"
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => {
                    setPlaying(false);
                    setPosition(0);
                }}
            />
            <button
                onClick={togglePlay}
                className={`shrink-0 ${compact ? 'w-8 h-8' : 'w-9 h-9'} rounded-full flex items-center justify-center transition-transform active:scale-95 ${
                    isMe ? 'bg-white/95 hover:bg-white text-[#2b5278]' : 'bg-[#5865F2] hover:bg-[#4752c4] text-white'
                }`}
                aria-label={playing ? 'Пауза' : 'Воспроизвести'}
                title={playing ? 'Пауза' : 'Воспроизвести'}
            >
                {playing ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16" rx="1.2" />
                        <rect x="14" y="4" width="4" height="16" rx="1.2" />
                    </svg>
                ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5">
                        <path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l10.9-6.86a1.04 1.04 0 0 0 0-1.76L9.56 4.26A1.04 1.04 0 0 0 8 5.14z" />
                    </svg>
                )}
            </button>
            <div
                onClick={seekFromEvent}
                className={`flex-1 flex items-center gap-[2px] ${compact ? 'h-6' : 'h-8'} cursor-pointer min-w-0`}
                title="Перемотка"
            >
                {bars.map((h, i) => {
                    const filled = i / bars.length < progress;
                    return (
                        <span
                            key={i}
                            className={`flex-1 rounded-full transition-colors duration-150 ${filled ? filledCls : emptyCls}`}
                            style={{ height: `${Math.round(h * 100)}%`, minWidth: 2 }}
                        />
                    );
                })}
            </div>
            <span className={`shrink-0 text-[11px] tabular-nums ${isMe ? 'text-white/75' : 'text-[#8f9aa7]'}`}>
                {playing && duration > 0
                    ? formatTime(duration - position)
                    : duration > 0
                        ? formatTime(duration)
                        : '…'}
            </span>
        </div>
    );
};

export default VoicePlayer;
