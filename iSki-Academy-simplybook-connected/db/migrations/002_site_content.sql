CREATE TABLE IF NOT EXISTS site_content (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  content_type ENUM('post','photo') NOT NULL DEFAULT 'post',
  title VARCHAR(180) NOT NULL,
  slug VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  image_url VARCHAR(1000) NULL,
  category VARCHAR(80) NOT NULL DEFAULT 'Stories',
  published TINYINT(1) NOT NULL DEFAULT 0,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_site_content_user FOREIGN KEY (created_by) REFERENCES admin_users(id),
  UNIQUE KEY uq_site_content_slug (slug),
  KEY idx_site_content_public (published, content_type, updated_at)
) ENGINE=InnoDB;
