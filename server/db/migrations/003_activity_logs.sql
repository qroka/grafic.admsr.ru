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
