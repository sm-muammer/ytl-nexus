-- Nexus Mail schema (MAIL-01, MAIL-10). Applied by `setup-mail` as the MariaDB
-- administrator and by the integration tests. Idempotent: IF NOT EXISTS throughout.
--
-- Three accounts touch this database, each with the least it needs:
--   nexus_mail_lookup  SELECT on the two tables (Postfix and Dovecot lookups)
--   nexus_mail_app     SELECT, INSERT, UPDATE, DELETE on the two tables (nexus-web, Control)
--   nexus_mail         the owner created by setup-database; only setup-mail uses it
--
-- A mailbox is a virtual user, never an operating system account. `password`
-- holds `{SHA512-CRYPT}$6$...` (MAIL-02), never a readable password.

CREATE TABLE IF NOT EXISTS `virtual_domains` (
  `id`   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(190) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_virtual_domains_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `virtual_users` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `domain_id`     INT UNSIGNED NOT NULL,
  `local_part`    VARCHAR(64)  NOT NULL,
  `email`         VARCHAR(255) NOT NULL,
  `password`      VARCHAR(255) NOT NULL,
  `quota_bytes`   BIGINT UNSIGNED NOT NULL DEFAULT 536870912,
  `enabled`       TINYINT(1)   NOT NULL DEFAULT 1,
  `nexus_user_id` VARCHAR(64)  NULL,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_virtual_users_email` (`email`),
  UNIQUE KEY `uq_virtual_users_local` (`domain_id`, `local_part`),
  UNIQUE KEY `uq_virtual_users_nexus_user` (`nexus_user_id`),
  CONSTRAINT `fk_virtual_users_domain` FOREIGN KEY (`domain_id`)
    REFERENCES `virtual_domains` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ck_virtual_users_quota` CHECK (`quota_bytes` >= 10485760 AND `quota_bytes` <= 2147483648),
  CONSTRAINT `ck_virtual_users_enabled` CHECK (`enabled` IN (0, 1)),
  CONSTRAINT `ck_virtual_users_scheme` CHECK (`password` LIKE '{SHA512-CRYPT}$6$%')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
