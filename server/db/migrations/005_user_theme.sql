-- Настройки темы Nuxt UI для каждого локального пользователя (не CRM).
ALTER TABLE users ADD COLUMN theme_primary TEXT;
ALTER TABLE users ADD COLUMN theme_neutral TEXT;
ALTER TABLE users ADD COLUMN theme_color_mode TEXT CHECK (
  theme_color_mode IS NULL OR theme_color_mode IN ('light', 'dark', 'auto')
);
