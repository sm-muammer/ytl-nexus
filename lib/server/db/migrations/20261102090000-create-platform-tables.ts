import { sql, type Kysely } from "kysely";

// Creates every platform table in `ytl_nexus`. Better Auth tables arrive with
// their own migration in Task 6. Text columns that hold user ids (`actor_id`,
// `opened_by`, `author_id`, `user_id`) have no foreign key yet because the
// user table does not exist until then.

const ENGINE =
  "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE audit_events (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      ts DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      actor_id VARCHAR(64) NULL,
      role ENUM('viewer','member','operator','admin') NULL,
      action VARCHAR(100) NOT NULL,
      target VARCHAR(255) NOT NULL,
      result ENUM('success','failure','refused','denied','rejected') NOT NULL,
      source_ip VARCHAR(45) NOT NULL,
      KEY audit_events_ts (ts),
      KEY audit_events_actor_ts (actor_id, ts),
      KEY audit_events_action_ts (action, ts)
    ) ${sql.raw(ENGINE)}`.execute(db);

  await sql`
    CREATE TABLE services (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(64) NOT NULL,
      name VARCHAR(120) NOT NULL,
      kind ENUM('web','database','mail','storage','ai','monitoring','proxy','system') NOT NULL,
      runbook_slug VARCHAR(100) NULL,
      unit VARCHAR(100) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY services_slug (slug)
    ) ${sql.raw(ENGINE)}`.execute(db);

  await sql`
    CREATE TABLE service_dependencies (
      service_id BIGINT UNSIGNED NOT NULL,
      depends_on_id BIGINT UNSIGNED NOT NULL,
      PRIMARY KEY (service_id, depends_on_id),
      KEY service_dependencies_target (depends_on_id),
      CONSTRAINT service_dependencies_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE,
      CONSTRAINT service_dependencies_target_fk FOREIGN KEY (depends_on_id) REFERENCES services (id) ON DELETE CASCADE,
      CONSTRAINT service_dependencies_not_self CHECK (service_id <> depends_on_id)
    ) ${sql.raw(ENGINE)}`.execute(db);

  await sql`
    CREATE TABLE service_checks (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      service_id BIGINT UNSIGNED NOT NULL,
      checked_at DATETIME(3) NOT NULL,
      state ENUM('healthy','degraded','down') NOT NULL,
      latency_ms INT UNSIGNED NULL,
      detail VARCHAR(255) NULL,
      KEY service_checks_service_time (service_id, checked_at),
      CONSTRAINT service_checks_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
    ) ${sql.raw(ENGINE)}`.execute(db);

  await sql`
    CREATE TABLE incidents (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      service_id BIGINT UNSIGNED NOT NULL,
      title VARCHAR(200) NOT NULL,
      state ENUM('open','investigating','monitoring','resolved') NOT NULL DEFAULT 'open',
      opened_at DATETIME(3) NOT NULL,
      resolved_at DATETIME(3) NULL,
      opened_by VARCHAR(64) NULL,
      KEY incidents_service (service_id),
      KEY incidents_state_opened (state, opened_at),
      CONSTRAINT incidents_service_fk FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE RESTRICT,
      CONSTRAINT incidents_resolution_matches_state CHECK ((state = 'resolved') = (resolved_at IS NOT NULL)),
      CONSTRAINT incidents_resolved_after_opened CHECK (resolved_at IS NULL OR resolved_at >= opened_at)
    ) ${sql.raw(ENGINE)}`.execute(db);

  await sql`
    CREATE TABLE incident_updates (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      incident_id BIGINT UNSIGNED NOT NULL,
      ts DATETIME(3) NOT NULL,
      author_id VARCHAR(64) NULL,
      body TEXT NOT NULL,
      KEY incident_updates_incident_time (incident_id, ts),
      CONSTRAINT incident_updates_incident FOREIGN KEY (incident_id) REFERENCES incidents (id) ON DELETE CASCADE
    ) ${sql.raw(ENGINE)}`.execute(db);

  await sql`
    CREATE TABLE backup_runs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      started_at DATETIME(3) NOT NULL,
      completed_at DATETIME(3) NOT NULL,
      status ENUM('ok','failed') NOT NULL,
      components_json LONGTEXT NOT NULL,
      KEY backup_runs_completed (completed_at),
      CONSTRAINT backup_runs_components_json CHECK (JSON_VALID(components_json)),
      CONSTRAINT backup_runs_time_order CHECK (completed_at >= started_at)
    ) ${sql.raw(ENGINE)}`.execute(db);

  await sql`
    CREATE TABLE restore_tests (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      tested_at DATETIME(3) NOT NULL,
      component VARCHAR(64) NOT NULL,
      result ENUM('ok','failed') NOT NULL,
      detail VARCHAR(255) NULL,
      KEY restore_tests_time (tested_at)
    ) ${sql.raw(ENGINE)}`.execute(db);

  await sql`
    CREATE TABLE shield_findings (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      scan_id VARCHAR(64) NOT NULL,
      check_id VARCHAR(64) NOT NULL,
      severity ENUM('info','low','medium','high') NOT NULL,
      evidence TEXT NOT NULL,
      remediation TEXT NOT NULL,
      seen_at DATETIME(3) NOT NULL,
      UNIQUE KEY shield_findings_scan_check (scan_id, check_id),
      KEY shield_findings_seen (seen_at)
    ) ${sql.raw(ENGINE)}`.execute(db);

  await sql`
    CREATE TABLE data_sites (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(16) NOT NULL,
      name VARCHAR(120) NOT NULL,
      city VARCHAR(80) NOT NULL,
      state VARCHAR(80) NOT NULL,
      kind ENUM('data-centre','exchange','office','tower') NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY data_sites_code (code)
    ) ${sql.raw(ENGINE)}`.execute(db);

  await sql`
    CREATE TABLE data_assets (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      asset_tag VARCHAR(32) NOT NULL,
      name VARCHAR(120) NOT NULL,
      category ENUM('server','switch','router','firewall','access-point','ups','storage','other') NOT NULL,
      site_id BIGINT UNSIGNED NOT NULL,
      status ENUM('active','maintenance','retired') NOT NULL DEFAULT 'active',
      vendor VARCHAR(100) NOT NULL,
      model VARCHAR(100) NOT NULL,
      purchased_on DATE NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY data_assets_tag (asset_tag),
      KEY data_assets_site (site_id),
      KEY data_assets_category_status (category, status),
      CONSTRAINT data_assets_site_fk FOREIGN KEY (site_id) REFERENCES data_sites (id) ON DELETE RESTRICT
    ) ${sql.raw(ENGINE)}`.execute(db);

  await sql`
    CREATE TABLE data_tickets (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      ticket_no VARCHAR(24) NOT NULL,
      title VARCHAR(200) NOT NULL,
      asset_id BIGINT UNSIGNED NULL,
      site_id BIGINT UNSIGNED NOT NULL,
      priority ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
      status ENUM('open','scheduled','in-progress','done') NOT NULL DEFAULT 'open',
      scheduled_for DATE NULL,
      description TEXT NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY data_tickets_no (ticket_no),
      KEY data_tickets_asset (asset_id),
      KEY data_tickets_site (site_id),
      KEY data_tickets_status_priority (status, priority),
      CONSTRAINT data_tickets_asset_fk FOREIGN KEY (asset_id) REFERENCES data_assets (id) ON DELETE SET NULL,
      CONSTRAINT data_tickets_site_fk FOREIGN KEY (site_id) REFERENCES data_sites (id) ON DELETE RESTRICT
    ) ${sql.raw(ENGINE)}`.execute(db);

  await sql`
    CREATE TABLE ai_chunks (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      source VARCHAR(255) NOT NULL,
      chunk_index INT UNSIGNED NOT NULL DEFAULT 0,
      audience ENUM('public','viewer','member','operator','admin') NOT NULL,
      text MEDIUMTEXT NOT NULL,
      embedding BLOB NOT NULL,
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY ai_chunks_source_index (source, chunk_index),
      KEY ai_chunks_audience (audience)
    ) ${sql.raw(ENGINE)}`.execute(db);

  await sql`
    CREATE TABLE ai_conversations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      title VARCHAR(200) NOT NULL,
      messages_json LONGTEXT NOT NULL,
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      KEY ai_conversations_user_time (user_id, updated_at),
      CONSTRAINT ai_conversations_messages_json CHECK (JSON_VALID(messages_json))
    ) ${sql.raw(ENGINE)}`.execute(db);
}

// Children before parents so foreign keys never block a drop.
const DROP_ORDER = [
  "ai_conversations",
  "ai_chunks",
  "data_tickets",
  "data_assets",
  "data_sites",
  "shield_findings",
  "restore_tests",
  "backup_runs",
  "incident_updates",
  "incidents",
  "service_checks",
  "service_dependencies",
  "services",
  "audit_events",
] as const;

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const table of DROP_ORDER) {
    await sql`DROP TABLE IF EXISTS ${sql.table(table)}`.execute(db);
  }
}
