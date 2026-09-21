# Saturn — деплой и запуск

## Структура
- `client/` — React (Vite) фронтенд
- `server/` — Express + JWT + SQLite бэкенд

## Локальный запуск
```bash
cd server && npm install && npm start        # API на :3000
cd client && npm install && npm run dev      # UI на :5173
```

## Хостинг для тестов с другом (рекомендуется: клиент на Netlify, сервер на Railway)

### Шаг 0. Залить проект в GitHub
```bash
# установи git (https://git-scm.com/download/win), затем в папке проекта:
git init
git add -A
git commit -m "Saturn chat app"
# создай пустой репозиторий на github.com и:
git remote add origin https://github.com/<твой-ник>/saturn.git
git push -u origin main
```
Файлы `saturn.db` и `uploads/` уже в .gitignore — в репозиторий не попадут.

### Шаг 1. Сервер на Railway
1. [railway.app](https://railway.app) → войти через GitHub → New Project → **Deploy from GitHub repo** → выбери репозиторий.
2. В созданном сервисе: Settings → Root Directory = `server` (команда старта `npm start` подтянется из package.json).
3. Variables → добавь:
   - `JWT_SECRET` = любой длинный случайный секрет
   - `DB_PATH` = `/data/saturn.db`
   - `UPLOADS_DIR` = `/data/uploads`
4. Settings → Volumes → **New Volume**, mount path = `/data` (иначе БД и картинки стираются при рестарте).
5. Settings → Networking → **Generate Domain** → получишь адрес API вида `https://saturn-api.up.railway.app`.

### Шаг 2. Клиент на Netlify
1. [netlify.com](https://netlify.com) → Add new site → **Import an existing project** → GitHub → репозиторий.
2. В настройках деплоя: Base directory = `client`, Build command = `npm run build`, Publish directory = `client/dist` (можно оставить пустыми — всё уже в `netlify.toml` в корне репозитория).
3. Environment variables → добавь `VITE_API_URL` = адрес API из шага 1 (без `/` в конце).
4. Deploy. Получишь адрес вида `https://saturn.netlify.app` — открывайте с другом.

> Важно: переменную `VITE_API_URL` задавай ДО первой сборки (при изменении — Deploys → Trigger deploy, Vite подставляет адрес при сборке).

### Обновления
Любой `git push` в репозиторий автоматически передеплоит и Netlify, и Railway.

### Быстрая проверка после деплоя
- Открой `https://<адрес API>/health` → должно быть `{"ok":true,...}`.
- Зарегистрируйся, найди друга по логину, отправь сообщение.

## Переменные окружения сервера
| Переменная | Назначение | По умолчанию |
|---|---|---|
| `PORT` | порт API | 3000 |
| `JWT_SECRET` | подпись токенов | dev-secret (смени!) |
| `JWT_TTL` | срок жизни токена | 7d |
| `DB_PATH` | путь к файлу БД SQLite | `./saturn.db` |
| `UPLOADS_DIR` | папка аватаров и вложений | `./uploads` |

## Клиент
| Переменная | Назначение | По умолчанию |
|---|---|---|
| `VITE_API_URL` | адрес API (без `/` в конце) | `http://localhost:3000` |

## Тесты
```bash
cd server && npm test    # 73 интеграционных проверки
```

## Как тестировать вдвоём
1. Каждый открывает адрес клиента и регистрируется (email → логин/никнейм → пароль).
2. В поиске введите логин друга → клик по нему → пишите.
3. Непрочитанные — красный бейдж на чате; закрепляйте чаты ПКМ; картинки открываются в приложении.
