const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'saturn.db');

const db = new sqlite3.Database(DB_PATH);

const SCHEMA_VERSION = 8;

db.serialize(() => {
  db.get('PRAGMA user_version', (err, row) => {
    const version = err || !row ? 0 : row.user_version;

    // Вложенный serialize: statement'ы из асинхронного колбэка иначе выполняются в parallel-режиме
    db.serialize(() => {
      if (version < 2) {
        // Старая схема (groups/group_members/messages с group_id/notifications с group_invite) — пересоздаём
        db.run('DROP TABLE IF EXISTS groups');
        db.run('DROP TABLE IF EXISTS group_members');
        db.run('DROP TABLE IF EXISTS messages');
        db.run('DROP TABLE IF EXISTS notifications');
      }

      db.run('PRAGMA foreign_keys = ON');

      db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      public_key TEXT,
      bio TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      profile_link TEXT DEFAULT '',
      birth_date TEXT,
      last_seen TEXT,
      settings TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);

      if (version >= 4 && version < 5) {
        db.run('ALTER TABLE users ADD COLUMN last_seen TEXT', [], (e) => {
          if (e && !/duplicate column/i.test(String(e.message))) console.error('Migration v3 (last_seen) failed:', e.message);
        });
      }

      if (version >= 2 && version < 6) {
        // добавляем недостающие колонки пользователям старых баз
        db.run('ALTER TABLE users ADD COLUMN settings TEXT', [], (e) => {
          if (e && !/duplicate column/i.test(String(e.message))) console.error('Migration v6 (settings) failed:', e.message);
        });
        db.run('ALTER TABLE users ADD COLUMN last_seen TEXT', [], (e) => {
          if (e && !/duplicate column/i.test(String(e.message))) console.error('Migration v6 (last_seen) failed:', e.message);
        });
      }

      // Отдельной сущности "чат" нет: сообщение — это запись от пользователя к пользователю,
      // переписка выводится из пары (sender, recipient)
      db.run(`CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,
      recipient_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      payload TEXT NOT NULL,
      read_at TEXT,
      reply_to TEXT,
      forwarded_from TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

      if (version >= 2 && version < SCHEMA_VERSION) {
        // v2+: ответы и пересылка (ALTER идемпотентен — защищён проверкой на duplicate column)
        db.run('ALTER TABLE messages ADD COLUMN reply_to TEXT', [], (e) => {
          if (e && !/duplicate column/i.test(String(e.message))) console.error('Migration (reply_to) failed:', e.message);
        });
        db.run('ALTER TABLE messages ADD COLUMN forwarded_from TEXT', [], (e) => {
          if (e && !/duplicate column/i.test(String(e.message))) console.error('Migration (forwarded_from) failed:', e.message);
        });
      }

      // Служебные таблицы: создаются всегда (IF NOT EXISTS безопасен и для старых баз,
      // где миграционный блок пропущен, и для новых, где user_version = 0)
      db.run(`CREATE TABLE IF NOT EXISTS hidden_messages (
        user_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        PRIMARY KEY (user_id, message_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS chat_pins (
        user_id TEXT NOT NULL,
        partner_id TEXT NOT NULL,
        pin_order INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, partner_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (partner_id) REFERENCES users(id) ON DELETE CASCADE
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS hidden_chats (
        user_id TEXT NOT NULL,
        partner_id TEXT NOT NULL,
        PRIMARY KEY (user_id, partner_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (partner_id) REFERENCES users(id) ON DELETE CASCADE
      )`);

      if (version >= 2 && version < SCHEMA_VERSION) {
        // v2+: время прочтения сообщения получателем (статусы отправлено/прочитано)
        db.run('ALTER TABLE messages ADD COLUMN read_at TEXT', [], (e) => {
          if (e && !/duplicate column/i.test(String(e.message))) {
            console.error('Migration (read_at) failed:', e.message);
          }
        });
      }

      db.run(`CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

      db.run(`CREATE TABLE IF NOT EXISTS pinned_messages (
      id TEXT PRIMARY KEY,
      chat_a TEXT NOT NULL,
      chat_b TEXT NOT NULL,
      message_id TEXT NOT NULL,
      pinned_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (chat_a, chat_b, message_id),
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
      FOREIGN KEY (pinned_by) REFERENCES users(id) ON DELETE CASCADE
    )`);
      if (version >= 4 && version < 7) {
        db.run(`CREATE TABLE IF NOT EXISTS pinned_messages (
          id TEXT PRIMARY KEY,
          chat_a TEXT NOT NULL,
          chat_b TEXT NOT NULL,
          message_id TEXT NOT NULL,
          pinned_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          UNIQUE (chat_a, chat_b, message_id),
          FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
          FOREIGN KEY (pinned_by) REFERENCES users(id) ON DELETE CASCADE
        )`);
      }

      db.run(`CREATE TABLE IF NOT EXISTS message_reactions (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      emoji TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (message_id, user_id, emoji),
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

      db.run('CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages(sender_id, recipient_id, created_at)');
      db.run('CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id, created_at)');
      db.run('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read)');

      db.run(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    });
  });
});

function uid() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

module.exports = { db, run, get, all, uid, now };
