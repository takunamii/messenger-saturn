const jwt = require('jsonwebtoken');
const { get, run, now } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'saturn-dev-secret-change-me';
const TOKEN_TTL = process.env.JWT_TTL || '7d';

// Порог «онлайн» — активность за последнюю минуту
const ONLINE_WINDOW_MS = 60 * 1000;

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, username: user.username },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Токен отсутствует' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await get('SELECT id FROM users WHERE id = ?', [decoded.sub]);
    if (!user) {
      // токен подписан верно, но пользователя больше нет — считаем токен невалидным
      return res.status(401).json({ message: 'Недействительный токен' });
    }
    req.userId = decoded.sub;

    // heartbeat: каждый авторизованный запрос — признак активности
    run('UPDATE users SET last_seen = ? WHERE id = ?', [now(), decoded.sub]).catch(() => {});

    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Недействительный или истёкший токен' });
  }
}

module.exports = { signToken, authenticate, JWT_SECRET, ONLINE_WINDOW_MS };
