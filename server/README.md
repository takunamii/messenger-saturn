# Saturn Backend

Express + JWT + SQLite бэкенд для чат-приложения Saturn.

## Запуск

```bash
cd server
npm install
npm start        # http://localhost:3000
```

Переменные окружения (необязательные): `PORT`, `JWT_SECRET`, `JWT_TTL`.

## Тесты

```bash
npm test
```

Поднимает сервер на порту 3101 и прогоняет 27 интеграционных проверок
(регистрация, логин, профиль, поиск, группы, приглашения, уведомления, сообщения, контроль доступа).

## Эндпоинты

### Auth
- `POST /auth/register` — `{email, username, displayName, password, publicKey}` → `{token, user:{id,email,nickname}}`
- `POST /auth/login` — `{email, password}` → `{token, user:{id,email,nickname}}`
- `GET /auth/me` — проверка токена

### Users
- `GET /users/me` — свой профиль → `{_id, public:{displayName,username,status,lastSeenAt,bio,avatar,profileLink,birthDate}, createdAt, updatedAt}`; свой статус всегда `online`
- `PUT /users/me` — обновление профиля
- `GET /users/:id/public` — публичный профиль другого пользователя (статус по `last_seen`)
- `GET /users/search?query=` — поиск по username/displayName (мин. 3 символа; фронт дважды кодирует query — сервер декодирует повторно)
- `GET /users/me/notifications?limit=&offset=&read=` — `{notifications:[{_id,userId,type,payload,read,createdAt}], total}`
- `PUT /users/me/notifications/:id` — `{read:true}`

### Presence (статусы)
`last_seen` обновляется при каждом авторизованном запросе (heartbeat) и при логине. Статус: «онлайн» — активность за последнюю минуту; иначе фронт показывает «был(а) только что» / «был(а) N мин назад» / «N ч назад» / «N дн назад». Статус собеседника в шапке чата обновляется каждые 30 с.

### Groups / чаты

Сущности «чат» нет: переписка выводится из сообщений между парой пользователей (как личные чаты в Telegram). Отдельного создания чата/приглашений нет — переписка появляется после первого сообщения.

- `GET /users/me/chats` — список собеседников, с которыми есть переписка → `[{_id, name, username, avatar, lastMessage, updatedAt}]`
- `GET /chats/:userId/messages?page=&limit=` — сообщения между мной и пользователем → `{messages: [{_id, senderId, mine, payload:{payload}, createdAt}], total}`; попутно помечает уведомления `new_message` от этого пользователя прочитанными
- `POST /chats/:userId/messages` — `{type:'text', payload:'текст'}` — отправка; первое сообщение переписки создаёт получателю уведомление `new_message`

### Notifications
- `GET /users/me/notifications?limit=&offset=&read=` — `{notifications:[{_id,userId,type,payload,read,createdAt}], total}`
- `PUT /users/me/notifications/:id` — `{read:true}`

## Фронтенд

Клиент (`client/`) настроен на `http://localhost:3000`. Запуск:

```bash
cd client
npm install
npm run dev
```
