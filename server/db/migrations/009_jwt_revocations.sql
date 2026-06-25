CREATE TABLE IF NOT EXISTS jwt_revocations (
  token_jti TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jwt_revocations_expires_at
  ON jwt_revocations (expires_at);

ALTER TABLE users ADD COLUMN auth_epoch INTEGER NOT NULL DEFAULT 0;
