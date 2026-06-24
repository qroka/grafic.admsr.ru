# График заместителей — развёртывание на сервере

Приложение: **Vue 3** (фронт) + **Node.js API** (мероприятия, вложения) + **SQLite** (события) + **MySQL CRM** (участники, таблица `user`).

Типовая схема:

- **grafic.admsr.ru** — этот проект (`172.17.4.21`)
- **crm.admsr.ru** — legacy PHP CRM (`172.17.30.42`), в меню только **ссылка** на grafic

---

## 1. Требования

| Компонент | Версия |
|-----------|--------|
| Ubuntu | 20.04 / 22.04 |
| Node.js | 20 LTS |
| pnpm | 9+ |
| nginx | с SSL |
| MySQL CRM | доступ с сервера grafic к `172.17.30.42:3306` |

Сборка native-модуля SQLite:

```bash
sudo apt update
sudo apt install -y build-essential python3 curl
```

---

## 2. Установка Node.js и pnpm

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v

sudo npm install -g pnpm
pnpm -v
```

---

## 3. Код на сервере

```bash
sudo mkdir -p /var/www/grafic.admsr.ru
sudo chown $USER:$USER /var/www/grafic.admsr.ru
```

Скопируйте проект в `/var/www/grafic.admsr.ru/html` (git, rsync, архив).

```bash
cd /var/www/grafic.admsr.ru/html
pnpm install
```

---

## 4. Конфигурация API

```bash
cp .env.example server/.env
# Либо скопируйте html/.env → server/.env (production systemd читает server/.env)
nano server/.env
```

API загружает **оба** файла: сначала `html/.env`, затем `server/.env` (перекрывает).  
При запуске `node server/dist/index.js` раньше подхватывался только `server/.env` — из‑за этого `CRM_MOCK=false` в `html/.env` не действовал, и в списке были 4 демо-участника (Константинов, Иванова, …).

Пример для production:

```env
NODE_ENV=production
PORT=3001
HOST=127.0.0.1
CORS_ORIGIN=https://grafic.admsr.ru

JWT_SECRET=9f3c7a1d8b4e6f2a0c5d9e7f1b3a6c8d4e2f7a9b1c5d8e0f
JWT_EXPIRES_IN=8h

SQLITE_PATH=/var/lib/crm-schedule/crm.sqlite
UPLOAD_DIR=/var/lib/crm-schedule/uploads
UPLOAD_MAX_BYTES=26214400

SEED_USER_LOGIN=admin
SEED_USER_PASSWORD=задайте_свой_пароль_не_admin

CRM_MOCK=false

# Участники — HTTP к CRM (как corporate → asu_lookup.php). Порт 3306 снаружи не открываем.
CRM_BASE_URL=https://crm.admsr.ru
CRM_PARTICIPANTS_PATH=/crm_participants.php
CRM_HOST_HEADER=crm.admsr.ru
# Тот же, что CRM_LOOKUP_SECRET на CRM (часто asu_corporate_sync_key).
CRM_SYNC_SECRET=a2c91a6f63425bf124411e5293d0d17c546c5ef1198eaf7b
CRM_LOOKUP_URL=https://crm.admsr.ru/crm_lookup.php

# Прямой MySQL с grafic не нужен — закомментируйте CRM_DB_*:
# CRM_DB_HOST=172.17.30.42
# CRM_DB_USER=root
```

Секреты (на сервере):

```bash
openssl rand -hex 32          # JWT_SECRET
openssl rand -hex 24          # CRM_SYNC_SECRET — тот же в nginx CRM: fastcgi_param CRM_LOOKUP_SECRET
```

При `NODE_ENV=production` API **не стартует**, если пароль seed `admin` или `JWT_SECRET=dev-only-change-before-production`.

Каталоги данных:

```bash
sudo mkdir -p /var/lib/crm-schedule/uploads
sudo chown www-data:www-data /var/lib/crm-schedule
```

### Участники с CRM (без открытия MySQL)

На **30.42** выложите `crm_participants.php` и **`crm_send_mail.php`** (рядом с `config.php`).  
На CRM в php-fpm задайте `CRM_LOOKUP_SECRET` — тот же, что `CRM_SYNC_SECRET` на grafic.

Проверка с **corporate-testing** (4.21):

```bash
curl -sk -H "X-Sync-Secret: ВАШ_CRM_SYNC_SECRET" "https://crm.admsr.ru/crm_participants.php" | head
```

Должен быть JSON с `"success":true` и массивом `participants`.

---

## 5. Сборка

```bash
cd /var/www/grafic.admsr.ru/html

pnpm build:server
pnpm build
```

Проверка API вручную:

```bash
# API запущен (systemctl status grafic-api)?
curl -s http://127.0.0.1:3001/api/health
# ожидается {"ok":true,...}

curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/api/health
# ожидается 200 (раньше GET /api/ без маршрута давал 404 — это нормально)
```

Остановите тест (`Ctrl+C`) и настройте systemd.

---

## 6. systemd — автозапуск API

```bash
sudo nano /etc/systemd/system/grafic-api.service
```

```ini
[Unit]
Description=Grafic Schedule API
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/grafic.admsr.ru/html/server
EnvironmentFile=/var/www/grafic.admsr.ru/html/server/.env
ExecStart=/usr/bin/node /var/www/grafic.admsr.ru/html/server/dist/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable grafic-api
sudo systemctl start grafic-api
sudo systemctl status grafic-api
journalctl -u grafic-api -f
```

---

## 7. nginx

Пример: **`deploy/nginx-grafic.admsr.ru.conf`**

Суть:

- `root` → `html/dist`
- `location /api/` → `http://127.0.0.1:3001/api/`
- `location /` → `try_files` → `index.html` (SPA)

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 8. Связь с CRM

На **crm.admsr.ru** в меню ссылка на `https://grafic.admsr.ru/` (см. `$GRAFIC_SCHEDULE_URL` в `config.php` CRM).

Node и статика графика на CRM **не ставятся**. Пользователь открывает grafic и входит на **`/login`** (учётка из `SEED_*` в `.env` при первом запуске).

---

## 9. Проверка

1. `systemctl status grafic-api` — active
2. https://grafic.admsr.ru/ — открывается интерфейс
3. Вход логин/пароль из `SEED_USER_LOGIN` / `SEED_USER_PASSWORD`
4. В DevTools: `GET /api/participants` → 200, список сотрудников из CRM
5. Создать мероприятие → после F5 остаётся

---

## 10. Обновление версии

```bash
cd /var/www/grafic.admsr.ru/html
sudo cp /var/lib/crm-schedule/crm.sqlite /var/lib/crm-schedule/crm.sqlite.bak.$(date +%F)

git pull   # или залить файлы
pnpm install
pnpm build:server
pnpm build
sudo systemctl restart grafic-api
```

---

## 11. Частые проблемы

| Проблема | Решение |
|---------|---------|
| `pnpm install` падает на better-sqlite3 | `sudo apt install build-essential python3` |
| `/api/` — 502 | `systemctl start grafic-api`, проверить порт 3001 |
| Участники пустые / 502 | `crm_participants.php` на CRM, `CRM_SYNC_SECRET`, `curl` с 4.21 |
| В списке только 4 демо (Константинов, Иванова…) | `CRM_MOCK=true` или не загружен `.env` — в `server/.env` задать `CRM_MOCK=false`, перезапуск API; в ответе `GET /api/participants` поле `source` должно быть `http` или `mysql`, не `mock` |
| Белая страница | `pnpm build`, проверить `dist/index.html` и nginx `root` |
| Не пускает в график | Проверить `JWT_SECRET`, логин seed, `journalctl -u grafic-api` |
| `Invalid environment (production)` в journal | В `server/.env`: свой `SEED_USER_PASSWORD` (не `admin`), `JWT_SECRET` ≥32 символа (не dev-only-…) |
| Почта: `spawn sendmail ENOENT` | В `server/.env`: `MAIL_TRANSPORT=crm`, выложить `crm_send_mail.php` на CRM, перезапуск API |
| Почта не приходит | `curl` к `crm_send_mail.php`, `journalctl -u grafic-api \| grep crm mail` |

---

## 12. Разработка локально (Windows / Linux)

```bash
pnpm install
cp .env.example server/.env
pnpm dev:all
```

Фронт: http://localhost:5173  
API: http://localhost:3001  

Для локальной разработки можно `CRM_MOCK=true` в `server/.env`.

---

## Структура проекта

```text
html/
├── src/              Vue SPA
├── server/           Node API (Fastify)
│   ├── .env          конфиг production
│   └── dist/         после pnpm build:server
├── dist/             после pnpm build (отдаёт nginx)
├── data/             SQLite + uploads (или /var/lib/crm-schedule)
└── deploy/
    └── nginx-grafic.admsr.ru.conf
```
