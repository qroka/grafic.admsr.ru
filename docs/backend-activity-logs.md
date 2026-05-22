# Задача: журнал событий (backend)

Фронтенд готов: `/logs`, только для `role === 'admin'`. Данные сейчас из `src/config/logs-mock.ts`. Нужно заменить мок на API.

## Цель

Персистентный аудит действий в SQLite (`data/crm.sqlite`), REST API для страницы «Журнал», запись событий из существующих маршрутов (auth, events, attachments).

## Схема БД

Миграция `server/db/migrations/003_activity_logs.sql`:

```sql
CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  level TEXT NOT NULL CHECK (level IN ('info', 'success', 'warning', 'error')),
  category TEXT NOT NULL CHECK (category IN ('auth', 'event', 'attachment', 'participant', 'system')),
  action TEXT NOT NULL,
  message TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_login TEXT,
  user_name TEXT,
  entity_type TEXT,
  entity_id INTEGER,
  ip_address TEXT,
  meta_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_category ON activity_logs(category);
CREATE INDEX IF NOT EXISTS idx_activity_logs_level ON activity_logs(level);
```

## API

### `GET /api/logs` (только admin)

Query (все опционально):

| Параметр | Тип | Описание |
|----------|-----|----------|
| `q` | string | Поиск по message, action, user_login, user_name |
| `level` | `info\|success\|warning\|error` | Фильтр уровня |
| `category` | string | Фильтр категории |
| `from` | ISO date | Начало периода |
| `to` | ISO date | Конец периода |
| `limit` | number | По умолчанию 100, max 500 |
| `offset` | number | Пагинация |

Ответ:

```json
{
  "success": true,
  "total": 42,
  "items": [
    {
      "id": 1,
      "createdAt": "2026-05-22T14:32:10.000Z",
      "level": "success",
      "category": "auth",
      "action": "auth.login",
      "message": "Успешный вход в CRM",
      "userLogin": "admin",
      "userName": "Администратор CRM",
      "entityType": null,
      "entityId": null,
      "ipAddress": "172.17.10.5"
    }
  ]
}
```

Ошибки: `401` без токена, `403` для `role !== 'admin'`.

## Сервис записи

`server/src/services/activity-log.ts`:

```ts
logActivity(env, {
  level: 'info',
  category: 'event',
  action: 'event.create',
  message: 'Создано мероприятие «…»',
  userId?, userLogin?, userName?,
  entityType?: 'event',
  entityId?: number,
  ipAddress?: string,
  meta?: Record<string, unknown>,
})
```

Не бросать исключение наружу — сбой лога не должен ломать основной запрос (try/catch + `app.log.warn`).

## Точки интеграции (минимум)

| Место | action | level |
|-------|--------|-------|
| `POST /api/auth/login` success | `auth.login` | success |
| `POST /api/auth/login` fail | `auth.login_failed` | warning |
| `POST /api/events` | `event.create` | info |
| `PATCH /api/events/:id` | `event.update` | info |
| `DELETE /api/events/:id` | `event.delete` | info |
| `POST /api/events/:id/attachments` | `attachment.upload` | info |
| `DELETE /api/attachments/:id` | `attachment.delete` | info |
| Ошибка CRM participants (502) | `participant.fetch_failed` | warning |
| Старт сервера (опционально) | `system.start` | info |

IP: `request.ip` или заголовок `X-Forwarded-For` за прокси.

Пользователь: из JWT payload (`userId`, `login`, `name`) после `authenticate`.

## Фронтенд (после API)

1. `src/api/logs.ts` — `fetchActivityLogs(params)`
2. `src/composables/useActivityLogs.ts` — loading, error, filters
3. `src/pages/logs/index.vue` — убрать `mockActivityLogs`, подключить API
4. Убрать бейдж «Демо-данные»

Типы уже в `src/types/logs.ts`, утилиты в `src/utils/logs.ts`.

## Критерии приёмки

- [ ] Миграция применяется при старте сервера
- [ ] Admin видит список логов с фильтрами и пагинацией
- [ ] User с `role: user` получает 403 на `/api/logs`
- [ ] Создание/изменение/удаление мероприятия и загрузка файла пишут запись в `activity_logs`
- [ ] `created_at` в ответе API в ISO; фронт форматирует через `formatActivityLogTimestamp`

## Авторизация API (модель доступа)

- **Вход** — локальные пользователи SQLite (`users`), JWT. Роль в JWT обновляется при каждом запросе из БД (`findUserById`).
- **Мероприятия** (`/api/events`) — **shared calendar**: любой вошедший пользователь (`user` или `admin`) может создавать, изменять и удалять любые мероприятия. Per-user ownership не реализован.
- **Журнал** (`/api/logs`) — только `role === 'admin'`.
- **Health** — `GET /api/health` публичный (минимум полей); `GET /api/health/detailed` — admin + JWT.

## Не в scope (можно позже)

- Экспорт CSV
- Retention / автоочисть старше N дней
- WebSocket live tail
