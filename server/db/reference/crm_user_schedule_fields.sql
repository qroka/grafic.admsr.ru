-- Миграция таблицы crm.user: график заместителей, контакты
-- Выполнить на MySQL CRM (172.17.30.42), один раз.

ALTER TABLE `user`
  ADD COLUMN `u_phone` varchar(64) NOT NULL DEFAULT '' AFTER `u_email`,
  ADD COLUMN `u_office` varchar(64) NOT NULL DEFAULT '' COMMENT 'Кабинет' AFTER `u_phone`,
  ADD COLUMN `u_position` varchar(255) NOT NULL DEFAULT '' COMMENT 'Должность' AFTER `u_office`,
  ADD COLUMN `u_prem9` int NOT NULL DEFAULT 0 COMMENT 'График заместителей' AFTER `u_prem8`;
