-- HandyHub database schema (MySQL 8+)
-- Usually applied by `python seed.py --reset`, which creates the database named
-- in .env and runs this file. Manual alternative:
--   mysql -u root -p -e "CREATE DATABASE handyhub CHARACTER SET utf8mb4"
--   mysql -u root -p handyhub < schema.sql
-- All timestamps are stored in UTC (the app sets time_zone='+00:00' per connection).

-- ── Users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  username       VARCHAR(30)  NOT NULL UNIQUE,          -- shown as @handle, searchable
  email          VARCHAR(255) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,                 -- bcrypt hash, never the raw password
  name           VARCHAR(80)  NOT NULL,                 -- display name
  bio            TEXT         NULL,
  avatar_url     VARCHAR(500) NULL,                     -- NULL → generated initials avatar
  cover          VARCHAR(20)  NOT NULL DEFAULT 'ph-night',
  location       VARCHAR(80)  NULL,
  skills         JSON         NULL,                     -- ["נגרות", "ריתוך", ...]
  verified       BOOLEAN      NOT NULL DEFAULT FALSE,
  is_agent       BOOLEAN      NOT NULL DEFAULT FALSE,   -- AI agent account (part 2)
  personality    TEXT         NULL,                     -- agent personality prompt (part 2)
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── Login sessions (cookie holds a random token; we store only its SHA-256) ──
CREATE TABLE IF NOT EXISTS sessions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT      NOT NULL,
  token_hash  CHAR(64) NOT NULL UNIQUE,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── Follow graph (follower → followee) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS follows (
  follower_id  INT      NOT NULL,
  followee_id  INT      NOT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, followee_id),
  INDEX idx_followee (followee_id),
  FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (followee_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (follower_id <> followee_id)
);

-- ── Posts ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  author_id   INT          NOT NULL,
  kind        ENUM('project', 'tutorial') NOT NULL DEFAULT 'project',
  title       VARCHAR(200) NULL,                        -- tutorials only
  body_html   TEXT         NOT NULL,                    -- sanitized rich text (b / i / links)
  location    VARCHAR(80)  NULL,
  steps       JSON         NULL,                        -- tutorials: [{title, note, thumb}]
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_author (author_id, id),
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS post_images (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  post_id   INT          NOT NULL,
  url       VARCHAR(500) NOT NULL,
  position  TINYINT      NOT NULL DEFAULT 0,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- ── Hashtags (many-to-many with posts) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS tags (
  id    INT AUTO_INCREMENT PRIMARY KEY,
  name  VARCHAR(50) NOT NULL UNIQUE                     -- stored without the leading '#'
);

CREATE TABLE IF NOT EXISTS post_tags (
  post_id  INT NOT NULL,
  tag_id   INT NOT NULL,
  PRIMARY KEY (post_id, tag_id),
  INDEX idx_tag (tag_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id)  REFERENCES tags(id)  ON DELETE CASCADE
);
