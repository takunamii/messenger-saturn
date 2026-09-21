// Интеграционный тест API: регистрация, логин, профиль, поиск,
// неявные чаты (переписка между пользователями), уведомления.
// Запуск: npm test

const http = require('http');

process.env.PORT = '3101';
process.env.JWT_SECRET = 'test-secret';
const app = require('../src/index');

const BASE = 'http://localhost:3101';

function req(method, path, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const url = new URL(BASE + path);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const r = http.request(options, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        let json;
        try { json = JSON.parse(buf); } catch { json = buf; }
        resolve({ status: res.statusCode, data: json });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

let passed = 0;
let failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log(`  PASS ${name}`); }
  else { failed++; console.error(`  FAIL ${name}${extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''}`); }
}

(async () => {
  const ts = Date.now();
  const aEmail = `alice${ts}@test.com`;
  const bEmail = `bob${ts}@test.com`;

  console.log('== Auth ==');
  let r = await req('POST', '/auth/register', { body: { email: aEmail, username: `alice${ts}`, displayName: 'Алиса', password: 'secret123', publicKey: 'pk-a' } });
  check('register alice 201', r.status === 201 && r.data.token && r.data.user.id, r);
  const aliceTok = r.data.token;
  const aliceId = r.data.user.id;

  r = await req('POST', '/auth/register', { body: { email: aEmail, username: `alice2${ts}`, displayName: 'Алиса2', password: 'secret123' } });
  check('register duplicate email 409', r.status === 409, r);

  r = await req('POST', '/auth/register', { body: { email: `bad`, username: `x`, displayName: '', password: '1' } });
  check('register invalid 400', r.status === 400, r);

  r = await req('POST', '/auth/register', { body: { email: bEmail, username: `bob${ts}`, displayName: 'Боб', password: 'secret123', publicKey: 'pk-b' } });
  check('register bob 201', r.status === 201, r);
  const bobTok = r.data.token;
  const bobId = r.data.user.id;

  r = await req('POST', '/auth/login', { body: { email: aEmail, password: 'wrongpass' } });
  check('login wrong password 401', r.status === 401, r);

  r = await req('POST', '/auth/login', { body: { email: aEmail.toUpperCase(), password: 'secret123' } });
  check('login ok (case-insensitive email)', r.status === 200 && r.data.token && r.data.user.nickname === 'Алиса', r);

  r = await req('GET', '/users/me', {});
  check('users/me without token 401', r.status === 401, r);

  console.log('== Profile ==');
  r = await req('GET', '/users/me', { token: aliceTok });
  check('users/me ok', r.status === 200 && r.data._id === aliceId && r.data.public.username === `alice${ts}`, r);

  r = await req('PUT', '/users/me', { token: aliceTok, body: { displayName: 'Алиса Тест', bio: 'Привет!' } });
  check('PUT users/me ok', r.status === 200 && r.data.public.displayName === 'Алиса Тест' && r.data.public.bio === 'Привет!', r);

  console.log('== Search ==');
  r = await req('GET', `/users/search?query=${encodeURIComponent(encodeURIComponent(`bob${ts}`))}`, { token: aliceTok });
  check('search double-encoded query', r.status === 200 && Array.isArray(r.data) && r.data[0]?._id === bobId, r);

  console.log('== Chats (неявные переписки) ==');
  r = await req('GET', '/users/me/chats', { token: aliceTok });
  check('chats empty before messaging', r.status === 200 && r.data.length === 0, r);

  r = await req('POST', `/chats/${bobId}/messages`, { token: aliceTok, body: { type: 'text', payload: 'Привет, это Алиса' } });
  check('alice sends message to bob', r.status === 201 && r.data.mine === true, r);
  const msgId = r.data._id;

  r = await req('POST', `/chats/${aliceId}/messages`, { token: aliceTok, body: { type: 'text', payload: 'сам себе' } });
  check('message to self 400', r.status === 400, r);

  r = await req('POST', `/chats/nonexistent/messages`, { token: aliceTok, body: { type: 'text', payload: 'привет' } });
  check('message to unknown user 404', r.status === 404, r);

  r = await req('POST', `/chats/${bobId}/messages`, { token: aliceTok, body: { type: 'text', payload: '   ' } });
  check('empty message 400', r.status === 400, r);

  r = await req('GET', '/users/me/chats', { token: aliceTok });
  check('alice chat list has bob', r.status === 200 && r.data.length === 1 && r.data[0]._id === bobId && r.data[0].name === 'Боб' && r.data[0].lastMessage === 'Привет, это Алиса', r);

  r = await req('GET', '/users/me/notifications?read=false', { token: bobTok });
  check('no new_message notifications anymore (badges live on chat rows)', r.status === 200 && r.data.total === 0, r);

  // второе сообщение перед проверкой прочтения
  r = await req('POST', `/chats/${bobId}/messages`, { token: aliceTok, body: { type: 'text', payload: 'Второе сообщение' } });
  check('alice second message 201', r.status === 201, r);

  // пометка прочитанным при открытии чата (GET messages)
  r = await req('GET', `/chats/${aliceId}/messages`, { token: bobTok });
  check('bob opens chat, sees 2 messages', r.status === 200 && r.data.messages.length === 2 && r.data.messages[0].payload.payload === 'Привет, это Алиса', r);
  check('mine flags correct for bob', r.data.messages.every((m) => m.mine === false), r);
  check('readAt set immediately on open', r.data.messages.every((m) => m.readAt !== null), r);

  // сообщения от bob не прочитаны (bob не открывал чат в момент отправки)... наоборот: alice открыла — её уже прочитано?
  // нет: alice их ОТПРАВИЛА; их читает bob. Проверим после того как bob открыл чат: у alice они прочитаны
  r = await req('GET', `/chats/${bobId}/messages`, { token: aliceTok });
  check('alice sees read statuses after bob opened chat', r.status === 200 && r.data.messages.every((m) => m.readAt !== null), r);

  r = await req('GET', '/users/me/chats', { token: aliceTok });
  check('alice unreadCount for bob is 0 (bob opened chat)', r.status === 200 && r.data.find((c) => c._id === bobId).unreadCount === 0, r);

  // bob отправляет новое сообщение, не открывая чат со стороны... GET messages помечает его собственные как прочитанные только для alice
  r = await req('POST', `/chats/${aliceId}/messages`, { token: bobTok, body: { type: 'text', payload: 'Привет, это Боб' } });
  check('bob replies', r.status === 201 && r.data.mine === true, r);

  r = await req('GET', '/users/me/chats', { token: aliceTok });
  check('alice has unread badge for bob', r.status === 200 && r.data.find((c) => c._id === bobId).unreadCount === 1, r);

  r = await req('GET', '/users/me/chats', { token: aliceTok });
  check('chat lastMessage updated', r.status === 200 && r.data.find((c) => c._id === bobId).lastMessage === 'Привет, это Боб', r);

  // alice открывает чат — прочитано
  r = await req('GET', `/chats/${bobId}/messages`, { token: aliceTok });
  check('alice reads bobs message', r.status === 200 && r.data.messages.find((m) => m.payload.payload === 'Привет, это Боб').readAt !== null, r);

  r = await req('GET', '/users/me/chats', { token: aliceTok });
  check('unread badge cleared after opening chat', r.status === 200 && r.data.find((c) => c._id === bobId).unreadCount === 0, r);

  r = await req('GET', `/chats/${bobId}/messages`, { token: aliceTok });
  check('alice sees full conversation ordered', r.status === 200 && r.data.total === 3 && r.data.messages[2].payload.payload === 'Привет, это Боб' && r.data.messages[0].mine === true && r.data.messages[2].mine === false, r);

  console.log('== Third user can message directly ==');
  r = await req('POST', '/auth/register', { body: { email: `eve${ts}@test.com`, username: `eve${ts}`, displayName: 'Ева', password: 'secret123' } });
  const eveTok = r.data.token;
  const eveId = r.data.user.id;

  r = await req('POST', `/chats/${aliceId}/messages`, { token: eveTok, body: { type: 'text', payload: 'Привет Алиса, я Ева' } });
  check('eve messages alice directly', r.status === 201, r);

  r = await req('GET', '/users/me/chats', { token: aliceTok });
  check('alice has 2 chats now (bob + eve)', r.status === 200 && r.data.length === 2, r);

  r = await req('GET', '/users/me/chats', { token: eveTok });
  check('eve chat list has alice', r.status === 200 && r.data.length === 1 && r.data[0]._id === aliceId, r);

  console.log('== Notifications (legacy endpoint) ==');
  // генерация new_message уведомлений убрана — непрочитанность живёт на сообщениях (unreadCount/read_at)
  r = await req('GET', '/users/me/notifications?read=false', { token: aliceTok });
  check('no generated notifications', r.status === 200 && r.data.total === 0, r);

  r = await req('PUT', '/users/me/notifications/nonexistent', { token: aliceTok, body: { read: true } });
  check('mark nonexistent notif 404', r.status === 404, r);

  r = await req('GET', '/users/search?query=ab', { token: aliceTok });
  check('search short query -> []', r.status === 200 && r.data.length === 0, r);

  console.log('== Chat attachments (вложения) ==');
  // png-вложение
  const png2 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAHElEQVQoz2NkYPhfz0BEYBxV+KkULIQYBAIAJwEgwcTQzWYAAAAASUVORK5CYII=', 'base64');
  const fdImg = new FormData();
  fdImg.append('file', new Blob([png2], { type: 'image/png' }), 'pic.png');
  const upImg = await fetch(BASE + `/chats/${bobId}/attachments`, { method: 'POST', headers: { Authorization: `Bearer ${aliceTok}` }, body: fdImg });
  const upImgData = await upImg.json();
  check('image attachment 201', upImg.status === 201 && upImgData.type === 'image' && upImgData.payload.payload.startsWith('/uploads/attachments/'), upImgData);

  // аудио-вложение (голосовое) от alice к bob
  const fdAud = new FormData();
  fdAud.append('file', new Blob([Buffer.from('fake-ogg-data')], { type: 'audio/ogg' }), 'voice.ogg');
  const upAud = await fetch(BASE + `/chats/${bobId}/attachments`, { method: 'POST', headers: { Authorization: `Bearer ${aliceTok}` }, body: fdAud });
  check('audio attachment 201', upAud.status === 201 && (await upAud.json()).type === 'audio', upAud.status);

  // вложения от bob для разнообразия
  const fdVid = new FormData();
  fdVid.append('file', new Blob([Buffer.from('fake-mp4')], { type: 'video/mp4' }), 'clip.mp4');
  const upVid = await fetch(BASE + `/chats/${aliceId}/attachments`, { method: 'POST', headers: { Authorization: `Bearer ${bobTok}` }, body: fdVid });
  check('video attachment from bob 201', upVid.status === 201 && (await upVid.json()).type === 'video', upVid.status);

  r = await req('GET', `/chats/${bobId}/media`, { token: aliceTok });
  check('media list has 3 attachments of both users', r.status === 200 && r.data.media.length === 3
    && r.data.media.some((m) => m.type === 'image' && m.mine)
    && r.data.media.some((m) => m.type === 'audio')
    && r.data.media.some((m) => m.type === 'video' && !m.mine), r);

  const servedAtt = await fetch(BASE + upImgData.payload.payload);
  check('attachment served statically', servedAtt.status === 200, servedAtt.status);

  // вложение appears в GET messages с типом
  r = await req('GET', `/chats/${bobId}/messages`, { token: aliceTok });
  check('attachment message in chat history', r.status === 200 && r.data.messages.some((m) => m.type === 'image' && m.payload.payload.startsWith('/uploads/attachments/')), r);

  console.log('== Reply / Forward / Delete ==');
  // ответ на сообщение
  const firstMsg = (await req('GET', `/chats/${bobId}/messages`, { token: aliceTok })).data.messages[0];
  r = await req('POST', `/chats/${bobId}/messages`, { token: aliceTok, body: { type: 'text', payload: 'Отвечаю на первое', replyToId: firstMsg._id } });
  check('reply message 201', r.status === 201 && r.data.replyTo && r.data.replyTo.id === firstMsg._id, r);

  r = await req('GET', `/chats/${aliceId}/messages`, { token: bobTok });
  const withReply = r.data.messages.find((m) => m.payload.payload === 'Отвечаю на первое');
  check('reply visible with reference', r.status === 200 && !!withReply && withReply.replyTo && withReply.replyTo.text === 'Привет, это Алиса', r);

  // ответ на чужое сообщение из другого чата — нельзя
  r = await req('POST', `/chats/${bobId}/messages`, { token: aliceTok, body: { type: 'text', payload: 'фейк', replyToId: 'nonexistent' } });
  check('reply to nonexistent 400', r.status === 400, r);

  // пересылка: bob пересылает сообщение alice к eve
  r = await req('GET', `/chats/${aliceId}/messages`, { token: bobTok });
  const fwdSource = r.data.messages.find((m) => m.payload.payload === 'Привет, это Алиса');
  r = await req('POST', `/chats/${eveId}/forward`, { token: bobTok, body: { messageId: fwdSource._id } });
  check('forward 201 with forwardedFrom', r.status === 201 && r.data.forwardedFrom && r.data.forwardedFrom.id === aliceId && r.data.mine === true, r);

  r = await req('GET', `/chats/${bobId}/messages`, { token: eveTok });
  check('forwarded message visible to eve', r.status === 200 && r.data.messages.some((m) => m.payload.payload === 'Привет, это Алиса' && m.forwardedFrom && m.forwardedFrom.id === aliceId && m.forwardedFrom.displayName === 'Алиса Тест'), r);

  // удаление: любой участник переписки может удалить сообщение «для всех» (в т.ч. чужое)
  r = await req('DELETE', `/chats/${aliceId}/messages/${fwdSource._id}?mode=all`, { token: bobTok });
  check('delete for all by other participant ok', r.status === 200, r);

  r = await req('GET', `/chats/${bobId}/messages`, { token: aliceTok });
  check('message gone for both', r.status === 200 && !r.data.messages.some((m) => m._id === fwdSource._id), r);

  // удаление для себя (bob скрывает «Второе сообщение» от alice)
  r = await req('GET', `/chats/${aliceId}/messages`, { token: bobTok });
  const msgToHide = r.data.messages.find((m) => m.payload.payload === 'Второе сообщение');
  r = await req('DELETE', `/chats/${aliceId}/messages/${msgToHide._id}?mode=self`, { token: bobTok });
  check('delete for self ok', r.status === 200, r);

  r = await req('GET', `/chats/${aliceId}/messages`, { token: bobTok });
  check('hidden message not in bob view', r.status === 200 && !r.data.messages.some((m) => m._id === msgToHide._id), r);

  r = await req('GET', `/chats/${bobId}/messages`, { token: aliceTok });
  check('message still visible for alice', r.status === 200 && r.data.messages.some((m) => m._id === msgToHide._id), r);

  console.log('== Chat pins / delete chat / settings ==');
  // закрепление
  r = await req('POST', `/chats/${bobId}/pin`, { token: aliceTok, body: { pinned: true } });
  check('pin chat', r.status === 200 && r.data.pinned === true, r);

  r = await req('POST', `/chats/${eveId}/pin`, { token: aliceTok, body: { pinned: true } });
  check('pin second chat', r.status === 200, r);

  r = await req('GET', '/users/me/chats', { token: aliceTok });
  const pinnedList = r.data.filter((c) => c.pinned);
  check('pinned chats come first in order', r.status === 200 && pinnedList.length === 2 && r.data[0].pinned && r.data[1].pinned, r.data.map(c => ({ id: c._id, pinned: c.pinned })));

  // изменение порядка
  r = await req('POST', '/users/me/pins/reorder', { token: aliceTok, body: { order: [r.data[1]._id, r.data[0]._id] } });
  check('reorder pins', r.status === 200, r);

  r = await req('GET', '/users/me/chats', { token: aliceTok });
  check('reorder applied', r.status === 200 && r.data[0]._id === eveId && r.data[1]._id === bobId, r.data.map(c => c._id));

  // открепление
  r = await req('POST', `/chats/${bobId}/pin`, { token: aliceTok, body: { pinned: false } });
  check('unpin chat', r.status === 200 && r.data.pinned === false, r);

  // настройки интерфейса
  r = await req('PUT', '/users/me/settings', { token: aliceTok, body: { sidebarWidth: 400 } });
  check('save ui settings', r.status === 200 && r.data.settings.sidebarWidth === 400, r);

  r = await req('GET', '/users/me', { token: aliceTok });
  check('settings persisted', r.status === 200 && r.data.settings.sidebarWidth === 400, r.data.settings);

  // удаление чата для себя
  r = await req('DELETE', `/chats/${eveId}?mode=self`, { token: aliceTok });
  check('delete chat for self', r.status === 200, r);

  r = await req('GET', '/users/me/chats', { token: aliceTok });
  check('hidden chat not in list', r.status === 200 && !r.data.some((c) => c._id === eveId), r);

  // удаление чата для всех: переписка alice-bob очищается у обоих
  r = await req('DELETE', `/chats/${bobId}?mode=all`, { token: aliceTok });
  check('delete chat for all', r.status === 200, r);

  r = await req('GET', `/chats/${aliceId}/messages`, { token: aliceTok });
  check('chat messages gone for alice', r.status === 200 && r.data.total === 0, r);

  r = await req('GET', `/chats/${aliceId}/messages`, { token: bobTok });
  check('chat messages gone for bob too', r.status === 200 && r.data.total === 0, r);

  console.log('== Avatar upload (multer) ==');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const fd = new FormData();
  fd.append('avatar', new Blob([png], { type: 'image/png' }), 'test.png');
  const up = await fetch(BASE + '/users/me/avatar', { method: 'POST', headers: { Authorization: `Bearer ${aliceTok}` }, body: fd });
  const upData = await up.json();
  check('avatar upload 201', up.status === 201 && upData.avatar.startsWith('/uploads/avatar-'), upData);

  const fileRes = await fetch(BASE + upData.avatar);
  const fileBuf = Buffer.from(await fileRes.arrayBuffer());
  check('uploaded avatar served statically', fileRes.status === 200 && Buffer.compare(png, fileBuf) === 0, fileRes.status);

  r = await req('GET', '/users/me', { token: aliceTok });
  check('profile avatar updated', r.status === 200 && r.data.public.avatar === upData.avatar, r.data.public);

  // не-изображение отклоняется
  const fd2 = new FormData();
  fd2.append('avatar', new Blob([Buffer.from('not an image')], { type: 'text/plain' }), 'file.txt');
  const up2 = await fetch(BASE + '/users/me/avatar', { method: 'POST', headers: { Authorization: `Bearer ${aliceTok}` }, body: fd2 });
  check('non-image avatar rejected 400', up2.status === 400, up2.status);

  console.log('== Presence (статусы) ==');
  // alice активна (только что делала запросы) — bob видит её онлайн
  r = await req('GET', `/users/${aliceId}/public`, { token: bobTok });
  check('partner public profile', r.status === 200 && r.data._id === aliceId && r.data.public.displayName === 'Алиса Тест', r);
  check('active user is online', r.data.public.status === 'online', r.data.public);

  r = await req('GET', '/users/me', { token: aliceTok });
  check('self is always online', r.status === 200 && r.data.public.status === 'online' && !!r.data.public.lastSeenAt, r);

  // симулируем, что bob был активен 10 минут назад
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { db, run: dbRun } = require('../src/db');
  await new Promise((resolve) => dbRun('UPDATE users SET last_seen = ? WHERE id = ?', [tenMinAgo, bobId]).then(resolve, resolve));
  // ждём, пока запрос в очереди db выполнится
  await new Promise((resolve) => db.run('SELECT 1', resolve));

  r = await req('GET', `/users/${bobId}/public`, { token: aliceTok });
  check('inactive user is offline with lastSeenAt', r.status === 200 && r.data.public.status === 'offline' && !!r.data.public.lastSeenAt, r.data.public);

  // активность bob'а снова делает его онлайн
  await req('GET', '/users/me', { token: bobTok });
  r = await req('GET', `/users/${bobId}/public`, { token: aliceTok });
  check('user back online after activity', r.status === 200 && r.data.public.status === 'online', r.data.public);

  console.log(`\nИтого: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error('Test runner crashed:', e);
  process.exit(1);
});
