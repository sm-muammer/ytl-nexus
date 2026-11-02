import { sql, type Kysely } from "kysely";

// Better Auth's tables (user, session, account, verification, twoFactor) plus
// `auth_failures`, which feeds the sign-in lockout. The column names and types
// are the ones Better Auth expects for the admin and two-factor plugins; an
// integration test asks Better Auth's own migration planner whether anything is
// missing. We create them here, not with its CLI, so every schema change goes
// through the same reviewed up/down migrations.
//
// `session.stepUpAt` is our own column: the time of the last password plus TOTP
// check for Nexus Control (requirement 6.10).
//
// Ids are VARCHAR(64) so the user-id columns added in Task 5 can reference
// `user.id`. The foreign keys on those columns come last.

const ENGINE =
  "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE user (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      emailVerified TINYINT(1) NOT NULL DEFAULT 0,
      image TEXT NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      role ENUM('viewer','member','operator','admin') NOT NULL DEFAULT 'viewer',
      banned TINYINT(1) NOT NULL DEFAULT 0,
      banReason TEXT NULL,
      banExpires DATETIME(3) NULL,
      twoFactorEnabled TINYINT(1) NOT NULL DEFAULT 0,
      UNIQUE KEY user_email (email)
    ) ${sql.raw(ENGINE)}`.execute(db);

  await sql`
    CREATE TABLE session (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      expiresAt DATETIME(3) NOT NULL,
      token VARCHAR(255) NOT NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      ipAddress VARCHAR(64) NULL,
      userAgent VARCHAR(512) NULL,
      userId VARCHAR(64) NOT NULL,
      impersonatedBy VARCHAR(64) NULL,
      stepUpAt DATETIME(3) NULL,
      UNIQUE KEY session_token (token),
      KEY session_user (userId),
      CONSTRAINT session_user_fk FOREIGN KEY (userId) REFERENCES user (id) ON DELETE CASCADE
    ) ${sql.raw(ENGINE)}`.execute(db);

  await sql`
    CREATE TABLE account (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      accountId VARCHAR(255) NOT NULL,
      providerId VARCHAR(64) NOT NULL,
      userId VARCHAR(64) NOT NULL,
      accessToken TEXT NULL,
      refreshToken TEXT NULL,
      idToken TEXT NULL,
      accessTokenExpiresAt DATETIME(3) NULL,
      refreshTokenExpiresAt DATETIME(3) NULL,
      scope TEXT NULL,
      password VARCHAR(512) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY account_user (userId),
      UNIQUE KEY account_provider (providerId, accountId),
      CONSTRAINT account_user_fk FOREIGN KEY (userId) REFERENCES user (id) ON DELETE CASCADE
    ) ${sql.raw(ENGINE)}`.execute(db);

  await sql`
    CREATE TABLE verification (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      identifier VARCHAR(255) NOT NULL,
      value TEXT NOT NULL,
      expiresAt DATETIME(3) NOT NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY verification_identifier (identifier)
    ) ${sql.raw(ENGINE)}`.execute(db);

  await sql`
    CREATE TABLE twoFactor (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      secret TEXT NOT NULL,
      backupCodes TEXT NOT NULL,
      userId VARCHAR(64) NOT NULL,
      verified TINYINT(1) NOT NULL DEFAULT 1,
      failedVerificationCount INT NOT NULL DEFAULT 0,
      lockedUntil DATETIME(3) NULL,
      KEY twofactor_user (userId),
      CONSTRAINT twofactor_user_fk FOREIGN KEY (userId) REFERENCES user (id) ON DELETE CASCADE
    ) ${sql.raw(ENGINE)}`.execute(db);

  // One row per failed sign-in, keyed by "account:<email>" or "ip:<address>".
  await sql`
    CREATE TABLE auth_failures (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      subject VARCHAR(320) NOT NULL,
      failed_at DATETIME(3) NOT NULL,
      KEY auth_failures_subject_time (subject, failed_at),
      KEY auth_failures_time (failed_at)
    ) ${sql.raw(ENGINE)}`.execute(db);

  // User-id columns from Task 5 now point at real users. Deleting a user keeps
  // the history that mentions them (the id is cleared) and removes their chats.
  // `audit_events.actor_id` stays free text: the trail must outlive the account.
  await sql`ALTER TABLE incidents
    ADD CONSTRAINT incidents_opened_by_fk FOREIGN KEY (opened_by) REFERENCES user (id) ON DELETE SET NULL`.execute(
    db,
  );
  await sql`ALTER TABLE incident_updates
    ADD CONSTRAINT incident_updates_author_fk FOREIGN KEY (author_id) REFERENCES user (id) ON DELETE SET NULL`.execute(
    db,
  );
  await sql`ALTER TABLE ai_conversations
    ADD CONSTRAINT ai_conversations_user_fk FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE`.execute(
    db,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE ai_conversations DROP FOREIGN KEY ai_conversations_user_fk`.execute(
    db,
  );
  await sql`ALTER TABLE incident_updates DROP FOREIGN KEY incident_updates_author_fk`.execute(
    db,
  );
  await sql`ALTER TABLE incidents DROP FOREIGN KEY incidents_opened_by_fk`.execute(
    db,
  );
  for (const table of [
    "auth_failures",
    "twoFactor",
    "verification",
    "account",
    "session",
    "user",
  ]) {
    await sql`DROP TABLE IF EXISTS ${sql.table(table)}`.execute(db);
  }
}
