const express = require('express');
const path = require('path');
const multer = require('multer');
const { run, get, all, uid, now } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// нормализация пары участников переписки (для закрепов: не важно, кто «отправитель»)
function sortPair(a, b) {
  return a < b ? [a, b] : [b, a];
}

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads');
const ATTACHMENTS_DIR = path.join(UPLOADS_DIR, 'attachments');
require('fs').mkdirSync(ATTACHMENTS_DIR, { recursive: true });

function typeFromMime(mime) {
  if (/^image\//i.test(mime)) return 'image';
  if (/^video\//i.test(mime)) return 'video';
  if (/^audio\//i.test(mime)) return 'audio';
  return 'file';
}

const attachmentUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, ATTACHMENTS_DIR),
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '').toLowerCase();
      cb(null, `${uid()}${ext}`);
    }
  }),
  limits: { fileSize: 20 * 1024 * 1024 } // 20 MB
});

// GET /users/me/chats — список собеседников (переписка выводится из сообщений)
router.get('/users/me/chats', authenticate, async (req, res, next) => {
  try {
    const me = req.userId;
    const rows = await all(
      `SELECT u.id, u.username, u.display_name, u.avatar, u.last_seen,
        (SELECT m.payload FROM messages m
          WHERE (m.sender_id = ? AND m.recipient_id = u.id) OR (m.sender_id = u.id AND m.recipient_id = ?)
          ORDER BY m.created_at DESC LIMIT 1) AS last_payload,
        (SELECT m.type FROM messages m
          WHERE (m.sender_id = ? AND m.recipient_id = u.id) OR (m.sender_id = u.id AND m.recipient_id = ?)
          ORDER BY m.created_at DESC LIMIT 1) AS last_type,
        (SELECT m.created_at FROM messages m
          WHERE (m.sender_id = ? AND m.recipient_id = u.id) OR (m.sender_id = u.id AND m.recipient_id = ?)
          ORDER BY m.created_at DESC LIMIT 1) AS last_time,
        (SELECT COUNT(*) FROM messages mn
          WHERE mn.sender_id = u.id AND mn.recipient_id = ? AND mn.read_at IS NULL
            AND mn.id NOT IN (SELECT hm.message_id FROM hidden_messages hm WHERE hm.user_id = ?)) AS unread_count,
        (SELECT cp.pin_order FROM chat_pins cp WHERE cp.user_id = ? AND cp.partner_id = u.id LIMIT 1) AS pin_order
       FROM users u
       WHERE EXISTS (
         SELECT 1 FROM messages mm
         WHERE (mm.sender_id = ? AND mm.recipient_id = u.id) OR (mm.recipient_id = ? AND mm.sender_id = u.id)
       )
         AND NOT EXISTS (
         SELECT 1 FROM hidden_chats hc WHERE hc.user_id = ? AND hc.partner_id = u.id
       )
       ORDER BY pin_order IS NULL, pin_order ASC, last_time DESC`,
      [me, me, me, me, me, me, me, me, me, me, me, me]
    );

    const humanizeLast = (type, payload) => {
      switch (type) {
        case 'image': return 'Изображение';
        case 'video': return 'Видеофайл';
        case 'audio': return 'Голосовое сообщение';
        case 'file': return 'Файл';
        default: return payload || 'No messages yet';
      }
    };

    return res.json(
      rows.map((r) => ({
        _id: r.id,
        name: r.display_name,
        username: r.username,
        avatar: r.avatar || '',
        lastMessage: r.last_payload ? humanizeLast(r.last_type, r.last_payload) : 'No messages yet',
        lastMessageAt: r.last_time || null,
        unreadCount: r.unread_count || 0,
        lastSeenAt: r.last_seen || null,
        pinned: r.pin_order !== null && r.pin_order !== undefined,
        updatedAt: r.last_time
      }))
    );
  } catch (err) {
    next(err);
  }
});

// GET /chats/:userId/messages — сообщения между мной и пользователем
router.get('/chats/:userId/messages', authenticate, async (req, res, next) => {
  try {
    const me = req.userId;
    const partnerId = req.params.userId;

    const partner = await get('SELECT id FROM users WHERE id = ?', [partnerId]);
    if (!partner) return res.status(404).json({ message: 'Пользователь не найден' });

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const offset = (page - 1) * limit;

    // Я открыл чат — сообщения собеседника считаю прочитанными (статус «прочитано» у отправителя).
    // Обновляем ДО выборки, чтобы в ответе был актуальный readAt.
    await run(
      `UPDATE messages SET read_at = ?
       WHERE recipient_id = ? AND sender_id = ? AND read_at IS NULL`,
      [now(), me, partnerId]
    );

    const rows = await all(
      `SELECT m.*, rt.sender_id AS reply_sender_id, rt.payload AS reply_payload, rt.type AS reply_type,
              fu.display_name AS fwd_name
       FROM messages m
       LEFT JOIN messages rt ON rt.id = m.reply_to
       LEFT JOIN users fu ON fu.id = m.forwarded_from
       WHERE ((m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?))
         AND m.id NOT IN (SELECT hm.message_id FROM hidden_messages hm WHERE hm.user_id = ?)
       ORDER BY m.created_at ASC LIMIT ? OFFSET ?`,
      [me, partnerId, partnerId, me, me, limit, offset]
    );
    const totalRow = await get(
      `SELECT COUNT(*) AS c FROM messages
       WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)`,
      [me, partnerId, partnerId, me]
    );

    return res.json({
      messages: rows.map((m) => ({
        _id: m.id,
        senderId: m.sender_id,
        recipientId: m.recipient_id,
        mine: m.sender_id === me,
        type: m.type,
        payload: { type: m.type, payload: m.payload },
        readAt: m.read_at || null,
        replyTo: m.reply_to ? {
          id: m.reply_to,
          senderId: m.reply_sender_id,
          text: m.reply_payload || '',
          type: m.reply_type || 'text'
        } : null,
        forwardedFrom: m.forwarded_from ? { id: m.forwarded_from, displayName: m.fwd_name } : null,
        createdAt: m.created_at
      })),
      total: totalRow.c,
      page,
      limit
    });
  } catch (err) {
    next(err);
  }
});

// POST /chats/:userId/attachments — отправить вложение (изображение/видео/голосовое/файл)
router.post('/chats/:userId/attachments', authenticate, attachmentUpload.single('file'), async (req, res, next) => {
  try {
    const me = req.userId;
    const partnerId = req.params.userId;

    if (partnerId === me) {
      return res.status(400).json({ message: 'Нельзя отправить сообщение самому себе' });
    }
    const partner = await get('SELECT id FROM users WHERE id = ?', [partnerId]);
    if (!partner) return res.status(404).json({ message: 'Пользователь не найден' });

    if (!req.file) {
      return res.status(400).json({ message: 'Файл не получен' });
    }

    const type = typeFromMime(req.file.mimetype);
    const url = `/uploads/attachments/${req.file.filename}`;

    const id = uid();
    const ts = now();
    await run(
      `INSERT INTO messages (id, sender_id, recipient_id, type, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, me, partnerId, type, url, ts]
    );

    return res.status(201).json({
      _id: id,
      senderId: me,
      recipientId: partnerId,
      mine: true,
      type,
      payload: { type, payload: url },
      createdAt: ts
    });
  } catch (err) {
    next(err);
  }
});

// GET /chats/:userId/media — вложения переписки (изображения, видео, голосовые, файлы)
router.get('/chats/:userId/media', authenticate, async (req, res, next) => {
  try {
    const me = req.userId;
    const partnerId = req.params.userId;

    const partner = await get('SELECT id FROM users WHERE id = ?', [partnerId]);
    if (!partner) return res.status(404).json({ message: 'Пользователь не найден' });

    const rows = await all(
      `SELECT id, sender_id, type, payload, created_at FROM messages
       WHERE ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)) AND type != 'text'
       ORDER BY created_at DESC`,
      [me, partnerId, partnerId, me]
    );

    return res.json({
      media: rows.map((m) => ({
        _id: m.id,
        type: m.type,
        url: m.payload,
        mine: m.sender_id === me,
        createdAt: m.created_at
      }))
    });
  } catch (err) {
    next(err);
  }
});

// POST /chats/:userId/messages — отправить сообщение (опционально replyToId — ответ на сообщение)
router.post('/chats/:userId/messages', authenticate, async (req, res, next) => {
  try {
    const me = req.userId;
    const partnerId = req.params.userId;

    if (partnerId === me) {
      return res.status(400).json({ message: 'Нельзя отправить сообщение самому себе' });
    }
    const partner = await get('SELECT id FROM users WHERE id = ?', [partnerId]);
    if (!partner) return res.status(404).json({ message: 'Пользователь не найден' });

    const { type, payload, replyToId } = req.body || {};
    const text = typeof payload === 'string' ? payload : payload?.payload;
    if (!text || !String(text).trim()) {
      return res.status(400).json({ message: 'Текст сообщения не может быть пустым' });
    }

    // проверяем, что ответ относится к сообщению этой переписки
    let replyTo = null;
    if (replyToId) {
      replyTo = await get(
        `SELECT id FROM messages
         WHERE id = ? AND ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))`,
        [replyToId, me, partnerId, partnerId, me]
      );
      if (!replyTo) {
        return res.status(400).json({ message: 'Сообщение для ответа не найдено в этом чате' });
      }
    }

    const id = uid();
    const ts = now();
    await run(
      `INSERT INTO messages (id, sender_id, recipient_id, type, payload, reply_to, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, me, partnerId, type === 'image' ? 'image' : 'text', String(text), replyTo ? replyTo.id : null, ts]
    );

    return res.status(201).json({
      _id: id,
      senderId: me,
      recipientId: partnerId,
      mine: true,
      type: 'text',
      payload: { type: 'text', payload: String(text) },
      replyTo: replyTo ? { id: replyTo.id } : null,
      createdAt: ts
    });
  } catch (err) {
    next(err);
  }
});

// POST /chats/:userId/forward — переслать сообщение в переписку с другим пользователем
router.post('/chats/:userId/forward', authenticate, async (req, res, next) => {
  try {
    const me = req.userId;
    const partnerId = req.params.userId;
    const { messageId } = req.body || {};

    if (partnerId === me) {
      return res.status(400).json({ message: 'Нельзя отправить сообщение самому себе' });
    }
    const partner = await get('SELECT id FROM users WHERE id = ?', [partnerId]);
    if (!partner) return res.status(404).json({ message: 'Пользователь не найден' });

    const original = await get(
      `SELECT * FROM messages
       WHERE id = ? AND (sender_id = ? OR recipient_id = ?) AND type != 'deleted'`,
      [messageId, me, me]
    );
    if (!original) return res.status(404).json({ message: 'Сообщение не найдено' });

    const id = uid();
    const ts = now();
    await run(
      `INSERT INTO messages (id, sender_id, recipient_id, type, payload, forwarded_from, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, me, partnerId, original.type, original.payload, original.sender_id, ts]
    );

    return res.status(201).json({
      _id: id,
      senderId: me,
      recipientId: partnerId,
      mine: true,
      type: original.type,
      payload: { type: original.type, payload: original.payload },
      forwardedFrom: original.sender_id,
      createdAt: ts
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /chats/:userId/messages/:messageId?mode=self|all
router.delete('/chats/:userId/messages/:messageId', authenticate, async (req, res, next) => {
  try {
    const me = req.userId;
    const partnerId = req.params.userId;
    const mode = req.query.mode === 'all' ? 'all' : 'self';

    const msg = await get(
      `SELECT * FROM messages
       WHERE id = ? AND ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))`,
      [req.params.messageId, me, partnerId, partnerId, me]
    );
    if (!msg) return res.status(404).json({ message: 'Сообщение не найдено' });

    if (mode === 'all') {
      // удалить для всех может любой участник переписки
      await run(`DELETE FROM messages WHERE id = ?`, [req.params.messageId]);
      // закрепы сообщения тоже снимаются (каскадом, но на всякий случай явно)
      await run(`DELETE FROM pinned_messages WHERE message_id = ?`, [req.params.messageId]);
    } else {
      // скрыть только для себя
      await run(
        `INSERT OR IGNORE INTO hidden_messages (user_id, message_id) VALUES (?, ?)`,
        [me, req.params.messageId]
      );
    }

    return res.json({ ok: true, mode });
  } catch (err) {
    next(err);
  }
});

// GET /chats/:userId/pinned-messages — закреплённые сообщения переписки
router.get('/chats/:userId/pinned-messages', authenticate, async (req, res, next) => {
  try {
    const me = req.userId;
    const partnerId = req.params.userId;

    const partner = await get('SELECT id FROM users WHERE id = ?', [partnerId]);
    if (!partner) return res.status(404).json({ message: 'Пользователь не найден' });

    const rows = await all(
      `SELECT p.id AS pin_id, p.created_at AS pinned_at, p.pinned_by, m.*
       FROM pinned_messages p
       JOIN messages m ON m.id = p.message_id
       LEFT JOIN hidden_messages hm ON hm.message_id = m.id AND hm.user_id = ?
       WHERE p.chat_a = ? AND p.chat_b = ? AND hm.message_id IS NULL
       ORDER BY p.created_at ASC`,
      [me, sortPair(me, partnerId)[0], sortPair(me, partnerId)[1]]
    );

    return res.json({
      pinned: rows.map((r) => ({
        _id: r.id,
        senderId: r.sender_id,
        mine: r.sender_id === me,
        type: r.type,
        payload: { type: r.type, payload: r.payload },
        replyTo: r.reply_to ? { id: r.reply_to } : null,
        forwardedFrom: r.forwarded_from || null,
        readAt: r.read_at || null,
        createdAt: r.created_at,
        pinnedBy: r.pinned_by,
        pinnedAt: r.pinned_at
      }))
    });
  } catch (err) {
    next(err);
  }
});

// POST /chats/:userId/messages/:messageId/pin — закрепить сообщение (любой из пары)
router.post('/chats/:userId/messages/:messageId/pin', authenticate, async (req, res, next) => {
  try {
    const me = req.userId;
    const partnerId = req.params.userId;
    const messageId = req.params.messageId;

    const msg = await get(
      `SELECT * FROM messages
       WHERE id = ? AND ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)) AND type != 'deleted'`,
      [messageId, me, partnerId, partnerId, me]
    );
    if (!msg) return res.status(404).json({ message: 'Сообщение не найдено' });

    const [a, b] = sortPair(me, partnerId);
    const already = await get('SELECT id FROM pinned_messages WHERE chat_a = ? AND chat_b = ? AND message_id = ?', [a, b, messageId]);
    if (already) return res.json({ ok: true, pinned: true });

    const id = uid();
    await run(
      `INSERT INTO pinned_messages (id, chat_a, chat_b, message_id, pinned_by, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, a, b, messageId, me, now()]
    );
    return res.status(201).json({ ok: true, pinned: true, _id: id });
  } catch (err) {
    next(err);
  }
});

// DELETE /chats/:userId/messages/:messageId/pin — открепить сообщение
router.delete('/chats/:userId/messages/:messageId/pin', authenticate, async (req, res, next) => {
  try {
    const me = req.userId;
    const partnerId = req.params.userId;
    const [a, b] = sortPair(me, partnerId);
    await run('DELETE FROM pinned_messages WHERE chat_a = ? AND chat_b = ? AND message_id = ?', [a, b, req.params.messageId]);
    return res.json({ ok: true, pinned: false });
  } catch (err) {
    next(err);
  }
});

// POST /chats/:userId/pin — закрепить/открепить чат
router.post('/chats/:userId/pin', authenticate, async (req, res, next) => {  try {
    const me = req.userId;
    const partnerId = req.params.userId;
    const { pinned } = req.body || {};

    if (pinned === false) {
      await run('DELETE FROM chat_pins WHERE user_id = ? AND partner_id = ?', [me, partnerId]);
      return res.json({ ok: true, pinned: false });
    }

    const maxRow = await get('SELECT COALESCE(MAX(pin_order), -1) AS m FROM chat_pins WHERE user_id = ?', [me]);
    const order = (maxRow.m || -1) + 1;
    await run(
      `INSERT OR REPLACE INTO chat_pins (user_id, partner_id, pin_order) VALUES (?, ?, ?)`,
      [me, partnerId, order]
    );
    return res.json({ ok: true, pinned: true, pinOrder: order });
  } catch (err) {
    next(err);
  }
});

// POST /users/me/pins/reorder — новый порядок закреплённых чатов
router.post('/users/me/pins/reorder', authenticate, async (req, res, next) => {
  try {
    const { order } = req.body || {};
    if (!Array.isArray(order)) return res.status(400).json({ message: 'order должен быть массивом id' });

    await run('DELETE FROM chat_pins WHERE user_id = ?', [req.userId]);
    for (let i = 0; i < order.length; i++) {
      await run(
        `INSERT INTO chat_pins (user_id, partner_id, pin_order) VALUES (?, ?, ?)`,
        [req.userId, order[i], i]
      );
    }
    return res.json({ ok: true, count: order.length });
  } catch (err) {
    next(err);
  }
});

// DELETE /chats/:userId?mode=self|all — удалить чат
router.delete('/chats/:userId', authenticate, async (req, res, next) => {
  try {
    const me = req.userId;
    const partnerId = req.params.userId;
    const mode = req.query.mode === 'all' ? 'all' : 'self';

    const partner = await get('SELECT id FROM users WHERE id = ?', [partnerId]);
    if (!partner) return res.status(404).json({ message: 'Пользователь не найден' });

    if (mode === 'all') {
      // удалить всю переписку у обоих
      await run(
        `DELETE FROM messages
         WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)`,
        [me, partnerId, partnerId, me]
      );
      await run(`DELETE FROM pinned_messages WHERE (chat_a = ? AND chat_b = ?)`, [me < partnerId ? me : partnerId, me < partnerId ? partnerId : me]);
      // закрепления и скрытия у обоих сбрасываются
      await run('DELETE FROM chat_pins WHERE (user_id = ? AND partner_id = ?) OR (user_id = ? AND partner_id = ?)', [me, partnerId, partnerId, me]);
      await run('DELETE FROM hidden_chats WHERE (user_id = ? AND partner_id = ?) OR (user_id = ? AND partner_id = ?)', [me, partnerId, partnerId, me]);
    } else {
      // скрыть чат только у себя
      await run(
        `INSERT OR IGNORE INTO hidden_chats (user_id, partner_id) VALUES (?, ?)`,
        [me, partnerId]
      );
      await run('DELETE FROM chat_pins WHERE user_id = ? AND partner_id = ?', [me, partnerId]);
    }

    return res.json({ ok: true, mode });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
