import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { register } from '../api/api';
import type { AuthResponse, ApiError } from '../api/types';
import AuthLayout from './AuthLayout';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

const inputCls = "w-full px-4 py-3 bg-[#0e1621] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5865F2] border border-white/5 placeholder-[#5d6b7b] transition-all";
const labelCls = "block text-xs font-medium text-[#8f9aa7] mb-1.5 uppercase tracking-wider";

const STEPS = ['Почта', 'Профиль', 'Пароль'];

const RegisterForm: React.FC = () => {
    const [step, setStep] = React.useState(0);
    const [email, setEmail] = React.useState('');
    const [username, setUsername] = React.useState('');
    const [displayName, setDisplayName] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [password2, setPassword2] = React.useState('');
    const [error, setError] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const navigate = useNavigate();

    React.useEffect(() => {
        if (localStorage.getItem('token')) {
            navigate('/home', { replace: true });
        }
    }, [navigate]);

    const goNext = () => {
        setError('');
        if (step === 0) {
            if (!EMAIL_RE.test(email)) {
                setError('Введите корректный email');
                return;
            }
        }
        if (step === 1) {
            if (!USERNAME_RE.test(username)) {
                setError('Логин: 3–20 символов, латиница, цифры и _');
                return;
            }
            if (displayName.trim().length < 3) {
                setError('Никнейм должен быть не короче 3 символов');
                return;
            }
        }
        setStep(s => s + 1);
    };

    const goBack = () => {
        setError('');
        setStep(s => Math.max(0, s - 1));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;
        if (password.length < 6) {
            setError('Пароль должен быть не короче 6 символов');
            return;
        }
        if (password !== password2) {
            setError('Пароли не совпадают');
            return;
        }
        setLoading(true);
        try {
            const response: AuthResponse = await register({
                email,
                username,
                displayName,
                password,
                publicKey: '123' // Hardcoded publicKey as a temporary workaround
            });
            console.log('Successful registration:', response);
            setError('');
            navigate('/login');
        } catch (err) {
            const apiError = err as ApiError;
            console.error('Registration error:', apiError.message);
            setError(apiError.message);
        } finally {
            setLoading(false);
        }
    };

    const progressCls = (i: number) =>
        `flex-1 h-1 rounded-full transition-colors ${i <= step ? 'bg-[#5865F2]' : 'bg-white/10'}`;

    return (
        <AuthLayout title="Регистрация" subtitle="Создайте аккаунт за минуту">
            {error && (
                <div className="p-3 bg-red-500/10 text-red-400 rounded-lg text-sm border border-red-500/25">
                    {error}
                </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                    {STEPS.map((label, i) => (
                        <div key={label} className="flex-1">
                            <div className={progressCls(i)} />
                            <p className={`text-[10px] mt-1 uppercase tracking-wider ${i === step ? 'text-[#8ea1ff] font-semibold' : 'text-[#5d6b7b]'}`}>
                                {i + 1}. {label}
                            </p>
                        </div>
                    ))}
                </div>

                {step === 0 && (
                    <div className="space-y-4 pt-1">
                        <div>
                            <label htmlFor="reg-email" className={labelCls}>Почта</label>
                            <input
                                id="reg-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && goNext()}
                                className={inputCls}
                                placeholder="example@domain.com"
                                autoFocus
                            />
                            <p className="text-xs text-[#5d6b7b] mt-2">На этот адрес придут уведомления о сообщениях</p>
                        </div>
                        <button type="button" onClick={goNext} className="w-full bg-[#5865F2] hover:bg-[#4752c4] active:scale-[0.98] text-white py-3 px-4 rounded-xl font-medium transition-all shadow-lg shadow-[#5865F2]/20">
                            Далее
                        </button>
                    </div>
                )}

                {step === 1 && (
                    <div className="space-y-4 pt-1">
                        <div>
                            <label htmlFor="reg-username" className={labelCls}>Логин</label>
                            <input
                                id="reg-username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className={inputCls}
                                placeholder="username"
                                autoFocus
                            />
                            <p className="text-xs text-[#5d6b7b] mt-1">По нему вас найдут в поиске</p>
                        </div>
                        <div>
                            <label htmlFor="reg-display" className={labelCls}>Никнейм</label>
                            <input
                                id="reg-display"
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                className={inputCls}
                                placeholder="Как вас видят другие"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button type="button" onClick={goBack} className="flex-1 bg-[#222d3d] hover:bg-[#2b3646] text-white py-3 px-4 rounded-xl font-medium transition-all">
                                Назад
                            </button>
                            <button type="button" onClick={goNext} className="flex-1 bg-[#5865F2] hover:bg-[#4752c4] active:scale-[0.98] text-white py-3 px-4 rounded-xl font-medium transition-all shadow-lg shadow-[#5865F2]/20">
                                Далее
                            </button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-4 pt-1">
                        <div>
                            <label htmlFor="reg-password" className={labelCls}>Пароль</label>
                            <input
                                id="reg-password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={inputCls}
                                placeholder="Минимум 6 символов"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label htmlFor="reg-password2" className={labelCls}>Повторите пароль</label>
                            <input
                                id="reg-password2"
                                type="password"
                                value={password2}
                                onChange={(e) => setPassword2(e.target.value)}
                                className={inputCls}
                                placeholder="••••••••"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button type="button" onClick={goBack} className="flex-1 bg-[#222d3d] hover:bg-[#2b3646] text-white py-3 px-4 rounded-xl font-medium transition-all">
                                Назад
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 bg-[#5865F2] hover:bg-[#4752c4] active:scale-[0.98] text-white py-3 px-4 rounded-xl font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-[#5865F2]/20"
                            >
                                {loading ? 'Создаём аккаунт…' : 'Создать аккаунт'}
                            </button>
                        </div>
                    </div>
                )}
            </form>
        </AuthLayout>
    );
};

export default RegisterForm;
