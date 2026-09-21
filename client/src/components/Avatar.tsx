import * as React from 'react';
import { assetUrl } from '../utils/assetUrl';

const GRADIENTS = [
    'linear-gradient(135deg, #f75c5c 0%, #c23434 100%)',   // red
    'linear-gradient(135deg, #f7a35c 0%, #d97b28 100%)',   // orange
    'linear-gradient(135deg, #a695f5 0%, #6c5dd3 100%)',   // violet
    'linear-gradient(135deg, #6dd98a 0%, #2e9950 100%)',   // green
    'linear-gradient(135deg, #5cc9f7 0%, #2a86c2 100%)',   // cyan
    'linear-gradient(135deg, #5d8bf7 0%, #3b5bd9 100%)',   // blue
    'linear-gradient(135deg, #f75cb4 0%, #c22e86 100%)',   // pink
];

interface AvatarProps {
    name: string;
    src?: string;
    size?: number;
    className?: string;
}

function gradientFor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    }
    return GRADIENTS[hash % GRADIENTS.length];
}

function initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

const Avatar: React.FC<AvatarProps> = ({ name, src, size = 44, className = '' }) => {
    const resolved = assetUrl(src);
    const [failed, setFailed] = React.useState(false);

    // новое изображение — сбрасываем флаг ошибки загрузки
    React.useEffect(() => {
        setFailed(false);
    }, [resolved]);

    const showImage = resolved && !failed;
    const fontSize = Math.round(size * 0.38);

    return (
        <div
            className={`shrink-0 rounded-full flex items-center justify-center text-white font-semibold select-none overflow-hidden ${className}`}
            style={{
                width: size,
                height: size,
                background: showImage ? undefined : gradientFor(name || '?'),
                fontSize,
                lineHeight: 1,
            }}
            aria-hidden="true"
        >
            {showImage ? (
                <img
                    src={resolved}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={() => setFailed(true)}
                />
            ) : (
                initialsOf(name || '?')
            )}
        </div>
    );
};

export default Avatar;
