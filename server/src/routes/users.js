const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { run, get, all, uid, now } = require('../db');
const { authenticate, ONLINE_WINDOW_MS } = require('../middleware/auth');

const router = express.Router();

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
    cb(null, `avatar-${req.userId}-${Date.now()}${ext}`);
  }
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpe?g|png|webp|gif)$/i.test(file.mimetype)) cb(null, true);
    else cb(new Error('Поддерживаются только изображения (jpeg, png, webp, gif)'));
  }
});

// Статус по времени последней активности: online — активность за последнюю минуту
function computeStatus(lastSeen) {
  if (!lastSeen) return 'offline';
  const diffMs = Date.now() - new Date(lastSeen).getTime();
  return diffMs <= ONLINE_WINDOW_MS ? 'online' : 'offline';
}

function publicPayload(row, { self = false } = {}) {
  const status = self ? 'online' : computeStatus(row.last_seen);
  return {
    displayName: row.display_name,
    username: row.username,
    status,
    lastSeenAt: row.last_seen || null,
    bio: row.bio || '',
    avatar: row.avatar || '',
    profileLink: row.profile_link || '',
    birthDate: row.birth_date || null
  };
}

// GET /users/me — профиль текущего пользователя
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await get('SELECT * FROM users WHERE id = ?', [req.userId]);
    if (!user) return res.status(401).json({ message: 'Недействительный токен' });

    return res.json({
      _id: user.id,
      public: publicPayload(user, { self: true }),
      settings: (() => { try { return JSON.parse(user.settings || '{}'); } catch { return {}; } })(),
      createdAt: user.created_at,
      updatedAt: user.updated_at
    });
  } catch (err) {
    next(err);
  }
});

// PUT /users/me — обновление профиля
router.put('/me', authenticate, async (req, res, next) => {
  try {
    const user = await get('SELECT * FROM users WHERE id = ?', [req.userId]);
    if (!user) return res.status(401).json({ message: 'Недействительный токен' });

    const { displayName, username, bio, profileLink, birthDate } = req.body || {};

    if (displayName !== undefined && String(displayName).length < 3) {
      return res.status(400).json({ message: 'Display Name должен быть не короче 3 символов' });
    }
    if (username !== undefined && String(username).length < 3) {
      return res.status(400).json({ message: 'Username должен быть не короче 3 символов' });
    }

    const newUsername = username !== undefined ? String(username).trim() : user.username;
    if (newUsername !== user.username) {
      const exists = await get('SELECT id FROM users WHERE username = ? AND id != ?', [newUsername, req.userId]);
      if (exists) return res.status(409).json({ message: 'Этот username уже занят' });
    }

    await run(
      `UPDATE users SET
        display_name = ?, username = ?, bio = ?, profile_link = ?, birth_date = ?, updated_at = ?
       WHERE id = ?`,
      [
        displayName !== undefined ? String(displayName).trim() : user.display_name,
        newUsername,
        bio !== undefined ? String(bio) : user.bio,
        profileLink !== undefined ? String(profileLink) : user.profile_link,
        birthDate !== undefined ? (birthDate || null) : user.birth_date,
        now(),
        req.userId
      ]
    );

    const updated = await get('SELECT * FROM users WHERE id = ?', [req.userId]);
    return res.json({
      _id: updated.id,
      public: publicPayload(updated, { self: true }),
      createdAt: updated.created_at,
      updatedAt: updated.updated_at
    });
  } catch (err) {
    next(err);
  }
});

// POST /users/me/avatar — загрузка аватара файлом с устройства
router.post('/me/avatar', authenticate, avatarUpload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Файл не получен' });
    }

    const user = await get('SELECT * FROM users WHERE id = ?', [req.userId]);
    if (!user) return res.status(401).json({ message: 'Недействительный токен' });

    // удаляем старый файл аватара (локальные загрузки)
    if (user.avatar && user.avatar.startsWith('/uploads/')) {
      const oldPath = path.join(UPLOADS_DIR, path.basename(user.avatar));
      fs.unlink(oldPath, () => {});
    }

    const avatarUrl = `/uploads/${req.file.filename}`;
    await run('UPDATE users SET avatar = ?, updated_at = ? WHERE id = ?', [avatarUrl, now(), req.userId]);

    return res.status(201).json({ avatar: avatarUrl });
  } catch (err) {
    next(err);
  }
});

// PUT /users/me/settings — клиентские настройки интерфейса (ширина сайдбара и т.д.)
router.put('/me/settings', authenticate, async (req, res, next) => {
  try {
    const user = await get('SELECT settings FROM users WHERE id = ?', [req.userId]);
    if (!user) return res.status(401).json({ message: 'Недействительный токен' });

    let settings = {};
    try { settings = JSON.parse(user.settings || '{}'); } catch { settings = {}; }
    const incoming = req.body || {};
    const merged = { ...settings, ...incoming };

    await run('UPDATE users SET settings = ?, updated_at = ? WHERE id = ?', [JSON.stringify(merged), now(), req.userId]);
    return res.json({ settings: merged });
  } catch (err) {
    next(err);
  }
});

// GET /users/:id/public — публичный профиль другого пользователя (для статуса в шапке чата)
router.get('/:id/public', authenticate, async (req, res, next) => {
  try {
    const user = await get('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

    return res.json({
      _id: user.id,
      public: publicPayload(user)
    });
  } catch (err) {
    next(err);
  }
});

// GET /users/search?query=... — поиск по username/displayName (минимум 3 символа)
router.get('/search', authenticate, async (req, res, next) => {
  try {
    let query = String(req.query.query || '').trim();
    // фронтенд двойной-кодирует значение (encodeURIComponent внутри axios) — декодируем второй раз
    try {
      if (query.includes('%')) query = decodeURIComponent(query);
    } catch (_) { /* оставляем как есть */ }

    if (query.length < 3) {
      return res.json([]);
    }

    const like = `%${query.toLowerCase()}%`;
    const rows = await all(
      `SELECT id, username, display_name, bio, avatar, last_seen FROM users
       WHERE id != ? AND (LOWER(username) LIKE ? OR LOWER(display_name) LIKE ?)
       ORDER BY username LIMIT 20`,
      [req.userId, like, like]
    );

    return res.json(
      rows.map((u) => ({
        _id: u.id,
        username: u.username,
        public: { displayName: u.display_name, bio: u.bio || '', avatar: u.avatar || '' }
      }))
    );
  } catch (err) {
    next(err);
  }
});

// GET /users/me/notifications?limit=&offset=&read=
router.get('/me/notifications', authenticate, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const readParam = req.query.read;

    let where = 'WHERE user_id = ?';
    const params = [req.userId];
    if (readParam === 'true' || readParam === 'false') {
      where += ' AND read = ?';
      params.push(readParam === 'true' ? 1 : 0);
    }

    const rows = await all(
      `SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const totalRow = await get(`SELECT COUNT(*) AS c FROM notifications ${where}`, params);

    return res.json({
      notifications: rows.map((n) => ({
        _id: n.id,
        userId: n.user_id,
        type: n.type,
        payload: JSON.parse(n.payload || '{}'),
        read: !!n.read,
        createdAt: n.created_at
      })),
      total: totalRow.c
    });
  } catch (err) {
    next(err);
  }
});

// PUT /users/me/notifications/:id — пометить прочитанным
router.put('/me/notifications/:id', authenticate, async (req, res, next) => {
  try {
    const { read } = req.body || {};
    const notif = await get('SELECT * FROM notifications WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (!notif) return res.status(404).json({ message: 'Уведомление не найдено' });

    await run('UPDATE notifications SET read = ? WHERE id = ?', [read === false ? 0 : 1, req.params.id]);
    return res.json({ ok: true, id: req.params.id, read: read === false ? false : true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
