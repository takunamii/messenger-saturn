import * as React from 'react';

interface SaturnLogoProps {
    size?: number;
    className?: string;
    color?: string;
}

// Логотип по образцу: планета с кольцом, проходящим спереди и позади, с бликами
const SaturnLogo: React.FC<SaturnLogoProps> = ({ size = 28, className = '', color = '#e8eaed' }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        className={className}
        aria-hidden="true"
    >
        {/* кольцо: задняя дуга */}
        <g transform="rotate(-18 24 24)">
            <path
                d="M3 24 A 21 7 0 0 1 45 24"
                stroke={color}
                strokeWidth="3"
                strokeLinecap="round"
            />
        </g>
        {/* планета */}
        <circle cx="24" cy="24" r="13" fill={color} />
        {/* блики на планете */}
        <path
            d="M13.4 17.5 A 13 13 0 0 1 34.6 17.5"
            stroke="#17212b"
            strokeWidth="2.2"
            fill="none"
            transform="rotate(-18 24 24) translate(0 -2)"
        />
        <path
            d="M12.5 30.5 A 13 13 0 0 0 35.5 30.5"
            stroke="#17212b"
            strokeWidth="1.8"
            fill="none"
            transform="rotate(-18 24 24) translate(0 1)"
        />
        {/* кольцо: передняя дуга */}
        <g transform="rotate(-18 24 24)">
            <path
                d="M3 24 A 21 7 0 0 0 45 24"
                stroke={color}
                strokeWidth="3"
                strokeLinecap="round"
            />
        </g>
    </svg>
);

export default SaturnLogo;
