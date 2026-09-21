import * as React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginForm from './modules/auth/components/LoginForm';
import RegisterForm from './modules/auth/components/RegisterForm';
import Home from './modules/home/Home';

const App: React.FC = () => {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<LoginForm />} />
                <Route path="/login" element={<LoginForm />} />
                <Route path="/register" element={<RegisterForm />} />
                <Route path="/home" element={<Home />} />
                <Route path="/profile" element={<div className="min-h-screen bg-[#0e1621] flex items-center justify-center p-4 text-white">Профиль (в разработке)</div>} />
                {/* Маршрут 404 для обработки несуществующих страниц */}
                <Route path="*" element={<div className="min-h-screen bg-[#0e1621] flex items-center justify-center p-4 text-white">Страница не найдена (404)</div>} />
            </Routes>
        </Router>
    );
};

export default App;