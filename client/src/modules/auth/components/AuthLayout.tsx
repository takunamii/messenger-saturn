import * as React from 'react';
import SaturnLogo from '../../../components/SaturnLogo';

const AuthLayout: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({
    title,
    subtitle,
    children,
}) => {
    return (
        <div className="min-h-screen bg-[#0e1621] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Звёздный фон */}
            <div
                className="pointer-events-none absolute inset-0"
                style={{
                    background:
                        'radial-gradient(ellipse 80% 60% at 20% 0%, rgba(88,101,242,0.14), transparent), radial-gradient(ellipse 60% 50% at 90% 90%, rgba(240,180,91,0.08), transparent)',
                }}
            />
            {[
                { top: '12%', left: '15%' }, { top: '22%', left: '78%' }, { top: '65%', left: '8%' },
                { top: '80%', left: '60%' }, { top: '30%', left: '50%' }, { top: '70%', left: '88%' },
            ].map((pos, i) => (
                <span
                    key={i}
                    className="pointer-events-none absolute w-1 h-1 rounded-full bg-white/40 animate-pulse"
                    style={{ ...pos, animationDelay: `${i * 0.7}s` }}
                />
            ))}

            <div className="w-full max-w-md relative">
                <div className="bg-[#17212b] rounded-2xl shadow-2xl overflow-hidden border border-white/5">
                    <div className="px-8 pt-10 pb-8 flex flex-col items-center">
                        <SaturnLogo size={64} />                        <h1 className="text-white text-2xl font-bold tracking-wide">Saturn</h1>
                        <p className="text-[#8f9aa7] text-sm mt-1.5">{subtitle}</p>
                        <span className="sr-only">{title}</span>
                    </div>
                    <div className="px-8 pb-8 space-y-4">{children}</div>
                    <div className="px-8 py-5 text-center text-[#8f9aa7] text-sm border-t border-white/5">
                        {title === 'Вход' ? (
                            <p>Нет аккаунта? <a onClick={() => (window.location.href = '/register')} className="text-[#8ea1ff] hover:text-white cursor-pointer transition-colors">Зарегистрироваться</a></p>
                        ) : (
                            <p>Уже есть аккаунт? <a onClick={() => (window.location.href = '/login')} className="text-[#8ea1ff] hover:text-white cursor-pointer transition-colors">Войти</a></p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthLayout;
