const express = require('express');
const path = require('path');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const chatRoutes = require('./routes/chats');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// загруженные аватары
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/health', (req, res) => res.json({ ok: true, name: 'saturn-api' }));

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/', chatRoutes);

// 404
app.use((req, res) => res.status(404).json({ message: 'Маршрут не найден' }));

// обработчик ошибок
app.use((err, req, res, next) => {
  if (err && (err.code === 'LIMIT_FILE_SIZE' || /изображени|файл/i.test(err.message || ''))) {
    return res.status(400).json({ message: err.message || 'Файл слишком большой' });
  }
  console.error('API error:', err);
  res.status(500).json({ message: 'Внутренняя ошибка сервера' });
});

app.listen(PORT, () => {
  console.log(`Saturn API запущен на http://localhost:${PORT}`);
});

module.exports = app;
