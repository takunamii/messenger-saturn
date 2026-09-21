import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/api';
import type { AuthResponse, ApiError } from '../api/types';
import AuthLayout from './AuthLayout';
import { socket } from '../../../utils/socket';

const connectSocket = () => socket.connect();

const LoginForm: React.FC = () => {
    const [email, setEmail] = React.useState<string>('');
    const [password, setPassword] = React.useState<string>('');
    const [error, setError] = React.useState<string>('');
    const [loading, setLoading] = React.useState(false);
    const navigate = useNavigate();

    React.useEffect(() => {
        if (localStorage.getItem('token')) {
            navigate('/home', { replace: true });
        }
    }, [navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;
        setLoading(true);
        try {
            const response: AuthResponse = await login({ email, password });
            localStorage.setItem('token', response.token);
            connectSocket();
            setError('');
            navigate('/home');
        } catch (err) {
            const apiError = err as ApiError;
            setError(apiError.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout title="Вход" subtitle="Войдите, чтобы продолжить общение">
            {error && (
                <div className="p-3 bg-red-500/10 text-red-400 rounded-lg text-sm border border-red-500/25">
                    {error}
                </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="email" className="block text-xs font-medium text-[#8f9aa7] mb-1.5 uppercase tracking-wider">
                        Почта
                    </label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 bg-[#0e1621] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5865F2] border border-white/5 placeholder-[#5d6b7b] transition-all"
                        placeholder="example@domain.com"
                        required
                    />
                </div>
                <div>
                    <label htmlFor="password" className="block text-xs font-medium text-[#8f9aa7] mb-1.5 uppercase tracking-wider">
                        Пароль
                    </label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 bg-[#0e1621] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5865F2] border border-white/5 placeholder-[#5d6b7b] transition-all"
                        placeholder="••••••••"
                        required
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#5865F2] hover:bg-[#4752c4] active:scale-[0.98] text-white py-3 px-4 rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-[#5865F2] focus:ring-offset-2 focus:ring-offset-[#17212b] disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-[#5865F2]/20"
                >
                    {loading ? 'Входим…' : 'Войти'}
                </button>
            </form>
        </AuthLayout>
    );
};

export default LoginForm;
