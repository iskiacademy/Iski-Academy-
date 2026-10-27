CREATE TABLE IF NOT EXISTS app_settings (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Europe/Belgrade',
  opening_time TIME NOT NULL DEFAULT '09:00:00',
  closing_time TIME NOT NULL DEFAULT '17:00:00',
  season_start DATE NULL,
  season_end DATE NULL,
  turnaround_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  public_booking_enabled TINYINT(1) NOT NULL DEFAULT 0,
  setup_completed_at DATETIME(3) NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

INSERT IGNORE INTO app_settings (id, timezone, opening_time, closing_time, turnaround_minutes, public_booking_enabled)
VALUES (1, 'Europe/Belgrade', '09:00:00', '17:00:00', 0, 0);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(120) NOT NULL PRIMARY KEY,
  applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS instructors (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  display_name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NULL,
  whatsapp VARCHAR(32) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  selectable_by_guests TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_instructors_email (email),
  KEY idx_instructors_active (active, id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS admin_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(254) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('owner', 'admin', 'instructor') NOT NULL DEFAULT 'instructor',
  instructor_id BIGINT UNSIGNED NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_admin_users_email (email),
  UNIQUE KEY uq_admin_users_instructor (instructor_id),
  CONSTRAINT fk_admin_users_instructor FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS weekly_availability (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  instructor_id BIGINT UNSIGNED NOT NULL,
  weekday TINYINT UNSIGNED NOT NULL,
  starts_at TIME NOT NULL,
  ends_at TIME NOT NULL,
  effective_from DATE NULL,
  effective_until DATE NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_weekly_availability_instructor FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE CASCADE,
  CONSTRAINT chk_weekly_availability_weekday CHECK (weekday BETWEEN 1 AND 7),
  CONSTRAINT chk_weekly_availability_time CHECK (starts_at < ends_at),
  KEY idx_weekly_availability_lookup (instructor_id, weekday, effective_from, effective_until)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS availability_exceptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  instructor_id BIGINT UNSIGNED NULL,
  local_date DATE NOT NULL,
  starts_at TIME NULL,
  ends_at TIME NULL,
  kind ENUM('time_off', 'closure') NOT NULL,
  label VARCHAR(160) NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_availability_exception_instructor FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE CASCADE,
  CONSTRAINT fk_availability_exception_user FOREIGN KEY (created_by) REFERENCES admin_users(id),
  CONSTRAINT chk_availability_exception_pair CHECK ((starts_at IS NULL AND ends_at IS NULL) OR (starts_at < ends_at)),
  KEY idx_availability_exceptions_date (local_date, instructor_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS lesson_formats (
  code VARCHAR(64) NOT NULL PRIMARY KEY,
  lesson_type VARCHAR(48) NOT NULL,
  label VARCHAR(160) NOT NULL,
  duration_minutes SMALLINT UNSIGNED NOT NULL,
  max_participants SMALLINT UNSIGNED NOT NULL,
  capacity_confirmed TINYINT(1) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  bookable_online TINYINT(1) NOT NULL DEFAULT 1,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT chk_lesson_format_duration CHECK (duration_minutes BETWEEN 30 AND 600),
  CONSTRAINT chk_lesson_format_participants CHECK (max_participants BETWEEN 1 AND 30)
) ENGINE=InnoDB;

INSERT IGNORE INTO lesson_formats (code, lesson_type, label, duration_minutes, max_participants) VALUES
  ('kids-private-60', 'Kids', 'Kids private lesson · 60 minutes', 60, 1),
  ('kids-camp-120', 'Kids', 'Kids confidence camp · 2-hour lesson block', 120, 4),
  ('family-progress-90', 'Family', 'Family lesson · 90-minute block', 90, 4),
  ('family-day-240', 'Family', 'Family private day · 4 hours', 240, 4),
  ('family-day-300', 'Family', 'Family private day · 5 hours', 300, 4),
  ('adult-private-60', 'Adult Private', 'Adult private · 60 minutes', 60, 1),
  ('adult-semi-private-60', 'Adult Private', 'Adult semi-private · 60 minutes', 60, 2),
  ('performance-90', 'Performance Coaching', 'Performance coaching · 90 minutes', 90, 1);

CREATE TABLE IF NOT EXISTS bookings (
  id CHAR(36) NOT NULL PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(160) NOT NULL,
  whatsapp VARCHAR(32) NOT NULL,
  lesson_type VARCHAR(48) NOT NULL,
  format_code VARCHAR(64) NOT NULL,
  preferred_instructor_id BIGINT UNSIGNED NULL,
  assigned_instructor_id BIGINT UNSIGNED NOT NULL,
  local_date DATE NOT NULL,
  starts_at_utc DATETIME(3) NOT NULL,
  ends_at_utc DATETIME(3) NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Europe/Belgrade',
  participants SMALLINT UNSIGNED NOT NULL,
  skill_level VARCHAR(32) NOT NULL,
  source VARCHAR(32) NOT NULL,
  message VARCHAR(1000) NULL,
  deposit_link VARCHAR(500) NULL,
  status ENUM('New', 'Contacted', 'Confirmed', 'Deposit Paid', 'Completed', 'Cancelled') NOT NULL DEFAULT 'New',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_bookings_format FOREIGN KEY (format_code) REFERENCES lesson_formats(code),
  CONSTRAINT fk_bookings_preferred_instructor FOREIGN KEY (preferred_instructor_id) REFERENCES instructors(id) ON DELETE SET NULL,
  CONSTRAINT fk_bookings_assigned_instructor FOREIGN KEY (assigned_instructor_id) REFERENCES instructors(id),
  CONSTRAINT chk_booking_interval CHECK (ends_at_utc > starts_at_utc),
  CONSTRAINT chk_booking_participants CHECK (participants >= 1),
  KEY idx_bookings_instructor_date (assigned_instructor_id, local_date, status),
  KEY idx_bookings_local_date (local_date, status),
  KEY idx_bookings_status_created (status, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS booking_notes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  booking_id CHAR(36) NOT NULL,
  author_id BIGINT UNSIGNED NOT NULL,
  note VARCHAR(2000) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_booking_notes_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_booking_notes_author FOREIGN KEY (author_id) REFERENCES admin_users(id),
  KEY idx_booking_notes_booking_created (booking_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS booking_status_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  booking_id CHAR(36) NOT NULL,
  previous_status ENUM('New', 'Contacted', 'Confirmed', 'Deposit Paid', 'Completed', 'Cancelled') NULL,
  new_status ENUM('New', 'Contacted', 'Confirmed', 'Deposit Paid', 'Completed', 'Cancelled') NOT NULL,
  actor_id BIGINT UNSIGNED NULL,
  detail VARCHAR(240) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_booking_history_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_booking_history_actor FOREIGN KEY (actor_id) REFERENCES admin_users(id) ON DELETE SET NULL,
  KEY idx_booking_history_booking_created (booking_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  csrf_hash CHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_admin_sessions_user FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
  KEY idx_admin_sessions_user_expiry (user_id, expires_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS preauth_tokens (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  kind ENUM('csrf', 'password_reset') NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  expires_at DATETIME(3) NOT NULL,
  used_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_preauth_tokens_user FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
  KEY idx_preauth_tokens_expiry (kind, expires_at, used_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS login_attempts (
  key_hash CHAR(64) NOT NULL PRIMARY KEY,
  attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  window_started_at DATETIME(3) NOT NULL,
  locked_until DATETIME(3) NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS public_rate_limits (
  key_hash CHAR(64) NOT NULL PRIMARY KEY,
  window_started_at DATETIME(3) NOT NULL,
  requests SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS email_outbox (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  booking_id CHAR(36) NULL,
  user_id BIGINT UNSIGNED NULL,
  recipient VARCHAR(254) NOT NULL,
  template_key VARCHAR(48) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  delivery_status ENUM('pending', 'sent', 'failed', 'not_configured') NOT NULL DEFAULT 'pending',
  provider_message_id VARCHAR(128) NULL,
  attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  last_error_code VARCHAR(80) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  sent_at DATETIME(3) NULL,
  CONSTRAINT fk_email_outbox_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_email_outbox_user FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_email_outbox_idempotency (idempotency_key),
  KEY idx_email_outbox_status_created (delivery_status, created_at)
) ENGINE=InnoDB;
