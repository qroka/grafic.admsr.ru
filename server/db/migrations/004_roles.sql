-- Роли: admin, manager (руководитель/зам), moderator, user

ALTER TABLE users ADD COLUMN external_user_id INTEGER;
ALTER TABLE users ADD COLUMN substitute_slug TEXT;

CREATE TABLE IF NOT EXISTS moderator_assignments (
  moderator_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  manager_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (moderator_user_id, manager_user_id)
);

CREATE INDEX IF NOT EXISTS idx_users_substitute_slug ON users(substitute_slug);
CREATE INDEX IF NOT EXISTS idx_moderator_assignments_moderator ON moderator_assignments(moderator_user_id);

-- Расширение CHECK для role (SQLite: пересоздание таблицы)
CREATE TABLE users_role_migration (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  login TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'moderator', 'user')),
  external_user_id INTEGER,
  substitute_slug TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO users_role_migration (
  id, login, password_hash, name, email, role, external_user_id, substitute_slug, created_at
)
SELECT id, login, password_hash, name, email, role, external_user_id, substitute_slug, created_at
FROM users;

DROP TABLE users;
ALTER TABLE users_role_migration RENAME TO users;
