const express = require('express');
const bcrypt = require('bcryptjs');
const { run, get, uid, now } = require('../db');
const { signToken, authenticate } = require('../middleware/auth');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { email, username, displayName, password, publicKey } = req.body || {};

    if (!email || !username || !displayName || !password) {
      return res.status(400).json({ message: 'Все поля обязательны: email, username, displayName, password' });
    }
    if (!EMAIL_RE.test(String(email))) {
      return res.status(400).json({ message: 'Некорректный email' });
    }
    if (String(username).length < 3 || String(displayName).length < 3) {
      return res.status(400).json({ message: 'Username и displayName должны быть не короче 3 символов' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Пароль должен быть не короче 6 символов' });
    }

    const emailNorm = String(email).toLowerCase().trim();
    const usernameNorm = String(username).trim();

    const existingEmail = await get('SELECT id FROM users WHERE email = ?', [emailNorm]);
    if (existingEmail) {
      return res.status(409).json({ message: 'Пользователь с таким email уже существует' });
    }
    const existingUsername = await get('SELECT id FROM users WHERE username = ?', [usernameNorm]);
    if (existingUsername) {
      return res.status(409).json({ message: 'Этот username уже занят' });
    }

    const id = uid();
    const ts = now();
    const passwordHash = await bcrypt.hash(String(password), 10);

    await run(
      `INSERT INTO users (id, email, username, display_name, password_hash, public_key, last_seen, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, emailNorm, usernameNorm, String(displayName).trim(), passwordHash, publicKey || null, ts, ts, ts]
    );

    const user = { id, email: emailNorm, username: usernameNorm };
    return res.status(201).json({
      token: signToken(user),
      user: { id, email: emailNorm, nickname: String(displayName).trim() }
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Email и пароль обязательны' });
    }

    const user = await get('SELECT * FROM users WHERE email = ?', [String(email).toLowerCase().trim()]);
    if (!user) {
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }

    const ok = await bcrypt.compare(String(password), user.password_hash);
    if (!ok) {
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }

    // успешный вход — пользователь онлайн
    await run('UPDATE users SET last_seen = ? WHERE id = ?', [now(), user.id]);

    return res.json({
      token: signToken(user),
      user: { id: user.id, email: user.email, nickname: user.display_name }
    });
  } catch (err) {
    next(err);
  }
});

// GET /auth/me — проверка токена (для отладки/фронта)
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await get('SELECT id, email, username, display_name, created_at FROM users WHERE id = ?', [req.userId]);
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });
    return res.json({
      token_user: { id: user.id, email: user.email, nickname: user.display_name },
      username: user.username,
      createdAt: user.created_at
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
