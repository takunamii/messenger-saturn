import * as React from 'react';

interface SaturnLogoProps {
    size?: number;
    className?: string;
    color?: string;
}

// Логотип проекта: изображение client/public/saturn.png на белой скруглённой плашке
// color оставлен для совместимости с существующими вызовами
const SaturnLogo: React.FC<SaturnLogoProps> = ({ size = 28, className = '' }) => (
    <div
        className={`bg-white flex items-center justify-center shrink-0 ${className}`}
        style={{
            width: size,
            height: size,
            borderRadius: Math.round(size * 0.28),
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
        }}
    >
        <img
            src="/saturn.png"
            alt="Saturn"
            width={Math.round(size * 0.6)}
            height={Math.round(size * 0.6)}
            draggable={false}
        />
    </div>
);

export default SaturnLogo;
