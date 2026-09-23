const express = require('express');
const path = require('path');
const cors = require('cors');
const http = require('http');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const chatRoutes = require('./routes/chats');
const { handleUpgrade } = require('./ws');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// загруженные аватары и вложения: имена файлов неизменны — кэшируем на месяц
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), {
  maxAge: '30d',
  immutable: true
}));

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

handleUpgrade(server);

server.listen(PORT, () => {
  console.log(`Saturn API запущен на http://localhost:${PORT} (WS: /ws)`);
});

module.exports = app;
