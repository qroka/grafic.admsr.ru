CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Локальные пользователи CRM Vue (не ASU)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  login TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Мероприятия (график заместителей)
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  substitute_slug TEXT NOT NULL,
  event_date TEXT NOT NULL,
  time TEXT NOT NULL DEFAULT '09:00',
  all_day INTEGER NOT NULL DEFAULT 0,
  place_label TEXT NOT NULL DEFAULT '',
  place_address TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  hidden INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT,
  organizer_external_id INTEGER,
  attachments_label TEXT NOT NULL DEFAULT 'Нет файлов',
  detail_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_substitute ON events(substitute_slug);

-- Связь мероприятия с участниками CRM (id из MySQL на 172.17.30.42)
CREATE TABLE IF NOT EXISTS event_participants (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  external_user_id INTEGER NOT NULL,
  PRIMARY KEY (event_id, external_user_id)
);

CREATE TABLE IF NOT EXISTS event_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  size_label TEXT NOT NULL DEFAULT ''
);
