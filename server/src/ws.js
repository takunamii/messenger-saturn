const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const url = require('url');
const { run, now } = require('./db');
const { JWT_SECRET } = require('./middleware/auth');

// userId -> Set<WebSocket>
const clients = new Map();
// userId -> typing state: { partnerId: true }
const typing = new Map();

const HEARTBEAT_MS = 30000;

function isOnline(userId) {
  return clients.has(userId) && clients.get(userId).size > 0;
}

function onlineUserIds() {
  return [...clients.keys()].filter((id) => clients.get(id).size > 0);
}

// отправить событие конкретному пользователю на все его соединения
function sendToUser(userId, event) {
  const set = clients.get(userId);
  if (!set) return;
  const data = JSON.stringify(event);
  for (const ws of set) {
    if (ws.readyState === 1) ws.send(data);
  }
}

// широковещательный presence: user X теперь online/offline
function broadcastPresence(userId, online) {
  const event = { type: 'presence', userId, online, at: now() };
  for (const [uid_, set] of clients) {
    if (uid_ === userId) continue;
    const data = JSON.stringify(event);
    for (const ws of set) {
      if (ws.readyState === 1) ws.send(data);
    }
  }
}

function handleUpgrade(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    let userId = null;
    try {
      const { query } = url.parse(req.url, true);
      const token = query.token;
      if (!token) throw new Error('no token');
      const decoded = jwt.verify(String(token), JWT_SECRET);
      userId = decoded.sub;
    } catch (e) {
      ws.close(4001, 'unauthorized');
      return;
    }

    let set = clients.get(userId);
    if (!set) {
      set = new Set();
      clients.set(userId, set);
    }
    set.add(ws);
    ws.isAlive = true;
    ws.userId = userId;

    run('UPDATE users SET last_seen = ? WHERE id = ?', [now(), userId]).catch(() => {});

    broadcastPresence(userId, true);
    // новому соединению сразу сообщаем, кто онлайн
    ws.send(JSON.stringify({ type: 'presence:init', online: onlineUserIds() }));

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg.type === 'ping' || msg.type === 'pong') return;

      // индикатор набора/записи: { type: 'typing', to, typing: bool, kind: 'typing'|'recording' }
      if (msg.type === 'typing' && typeof msg.to === 'string') {
        const partnerId = msg.to;
        const kind = msg.kind === 'recording' ? 'recording' : 'typing';
        let state = typing.get(userId);
        if (!state) {
          state = {};
          typing.set(userId, state);
        }
        const prev = state[partnerId] || null;
        const isTyping = !!msg.typing;
        state[partnerId] = isTyping ? kind : null;
        if ((!!prev) !== isTyping || (isTyping && prev !== kind)) {
          sendToUser(partnerId, { type: 'typing', from: userId, typing: isTyping, kind });
          if (isTyping) {
            // авто-сброс через 6с, если клиент перестал слать
            setTimeout(() => {
              const st = typing.get(userId);
              if (st && st[partnerId]) {
                st[partnerId] = null;
                sendToUser(partnerId, { type: 'typing', from: userId, typing: false, kind });
              }
            }, 6000);
          }
        }
      }
    });

    ws.on('close', () => {
      const set2 = clients.get(userId);
      if (set2) {
        set2.delete(ws);
        if (set2.size === 0) {
          clients.delete(userId);
          // сбрасываем все typing этого пользователя
          const st = typing.get(userId);
          if (st) {
            for (const partnerId of Object.keys(st)) {
              if (st[partnerId]) sendToUser(partnerId, { type: 'typing', from: userId, typing: false, kind: st[partnerId] });
            }
            typing.delete(userId);
          }
          run('UPDATE users SET last_seen = ? WHERE id = ?', [now(), userId]).catch(() => {});
          broadcastPresence(userId, false);
        }
      }
    });
  });

  // чистим мёртвые соединения
  const interval = setInterval(() => {
    for (const [, set] of clients) {
      for (const ws of set) {
        if (!ws.isAlive) {
          ws.terminate();
          continue;
        }
        ws.isAlive = false;
        try { ws.ping(); } catch { /* ignore */ }
      }
    }
  }, HEARTBEAT_MS);
  wss.on('close', () => clearInterval(interval));

  return wss;
}

module.exports = { handleUpgrade, sendToUser, isOnline, onlineUserIds, broadcastPresence };
