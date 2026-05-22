ALTER TABLE event_attachments ADD COLUMN storage_key TEXT;
ALTER TABLE event_attachments ADD COLUMN mime_type TEXT NOT NULL DEFAULT 'application/octet-stream';
ALTER TABLE event_attachments ADD COLUMN size_bytes INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_attachments_storage_key
  ON event_attachments(storage_key)
  WHERE storage_key IS NOT NULL;
