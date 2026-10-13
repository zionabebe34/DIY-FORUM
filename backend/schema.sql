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
  role           ENUM('user', 'moderator', 'admin') NOT NULL DEFAULT 'user',
  is_banned      BOOLEAN      NOT NULL DEFAULT FALSE,
  ban_reason     VARCHAR(300) NULL,
  banned_at      DATETIME     NULL,
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
  shared_post_id INT       NULL,                        -- a "share" post quotes another post (no FK: a deleted
                                                        -- original keeps its id so the share shows "removed")
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_author (author_id, id),
  INDEX idx_shared (shared_post_id),
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

-- ── Likes ("hearts") on posts ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_likes (
  user_id     INT      NOT NULL,
  post_id     INT      NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, post_id),
  INDEX idx_post (post_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- ── Comments (one level of nesting: a reply points at a top-level comment) ──
CREATE TABLE IF NOT EXISTS comments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  post_id     INT      NOT NULL,
  author_id   INT      NOT NULL,
  parent_id   INT      NULL,                            -- NULL = top-level comment
  body        TEXT     NOT NULL,                        -- plain text
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_post (post_id, id),
  FOREIGN KEY (post_id)   REFERENCES posts(id)    ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
);

-- ── Reports ("flag for review") + moderation outcome ──────────────────────
-- A report points at a post, a comment or a user. A snapshot of the reported
-- content is kept so moderators still see what it was after it is deleted.
CREATE TABLE IF NOT EXISTS reports (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  reporter_id     INT          NULL,                    -- NULL = flagged automatically (toxicity filter)
  target_type     ENUM('post', 'comment', 'user') NOT NULL,
  target_id       INT          NOT NULL,
  target_user_id  INT          NULL,                    -- author of the reported content / reported user
  snapshot        TEXT         NULL,                    -- the content as it was when reported
  reason          ENUM('spam', 'harassment', 'hate', 'violence', 'misinformation', 'other') NOT NULL,
  details         VARCHAR(500) NULL,
  status          ENUM('open', 'resolved', 'dismissed') NOT NULL DEFAULT 'open',
  resolution      VARCHAR(40)  NULL,                    -- content_deleted | user_banned | dismissed
  resolved_by     INT          NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at     DATETIME     NULL,
  INDEX idx_status (status, id),
  INDEX idx_target (target_type, target_id),
  FOREIGN KEY (reporter_id)    REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (resolved_by)    REFERENCES users(id) ON DELETE SET NULL
);

-- ── Password reset tokens (emailed link; only the SHA-256 is stored) ───────
CREATE TABLE IF NOT EXISTS password_resets (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT      NOT NULL,
  token_hash  CHAR(64) NOT NULL UNIQUE,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  DATETIME NOT NULL,
  used_at     DATETIME NULL,
  INDEX idx_user (user_id, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── Marketplace: tools for sale or for lending ──────────────────────────────
CREATE TABLE IF NOT EXISTS listings (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  seller_id       INT          NOT NULL,
  listing_type    ENUM('sale', 'lend') NOT NULL,
  title           VARCHAR(120) NOT NULL,
  description     TEXT         NULL,
  category        ENUM('hand', 'power', 'machines', 'other') NOT NULL DEFAULT 'other',
  condition_text  VARCHAR(80)  NOT NULL,
  price           INT          NULL,                    -- sale (₪)
  daily_price     INT          NULL,                    -- lend (₪ / day)
  weekly_price    INT          NULL,                    -- lend (₪ / week)
  deposit         INT          NULL,                    -- lend (₪)
  image_url       VARCHAR(500) NULL,
  cover           VARCHAR(20)  NOT NULL DEFAULT 'ph-steel',  -- placeholder gradient when there's no photo
  status          ENUM('active', 'closed') NOT NULL DEFAULT 'active',
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status (status, id),
  INDEX idx_seller (seller_id, id),
  FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── Store reviews: stores are created by the first review that names them ──
CREATE TABLE IF NOT EXISTS stores (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  area        VARCHAR(120) NOT NULL DEFAULT '',
  cover       VARCHAR(20)  NOT NULL DEFAULT 'ph-wood',
  address     VARCHAR(200) NULL,
  phone       VARCHAR(40)  NULL,
  hours       VARCHAR(120) NULL,
  summary     TEXT         NULL,
  tags        JSON         NULL,
  created_by  INT          NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_store (name, area),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS store_reviews (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  store_id    INT          NOT NULL,
  author_id   INT          NOT NULL,
  rating      DECIMAL(2,1) NOT NULL,                    -- 1.0 – 5.0
  body        TEXT         NULL,
  pros        JSON         NULL,
  cons        JSON         NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_review (store_id, author_id),           -- one review per user per store (re-reviewing updates it)
  FOREIGN KEY (store_id)  REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id)  ON DELETE CASCADE
);

-- ── Private 1-on-1 messages ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  sender_id     INT      NOT NULL,
  recipient_id  INT      NOT NULL,
  body          TEXT     NOT NULL,
  listing_id    INT      NULL,                          -- set when the chat started from a marketplace listing
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at       DATETIME NULL,
  INDEX idx_inbox (recipient_id, read_at),
  INDEX idx_pair (sender_id, recipient_id, id),
  FOREIGN KEY (sender_id)    REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (listing_id)   REFERENCES listings(id) ON DELETE SET NULL
);

-- ── Saved items ("bookmarks"): posts and marketplace listings ───────────────
CREATE TABLE IF NOT EXISTS saved_posts (
  user_id     INT      NOT NULL,
  post_id     INT      NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, post_id),
  INDEX idx_post (post_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS saved_listings (
  user_id     INT      NOT NULL,
  listing_id  INT      NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, listing_id),
  INDEX idx_listing (listing_id),
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

-- ── Notifications (likes, comments, replies, @mentions, follows, saves) ─────
-- Deleting the post / comment / actor removes the notifications about it.
CREATE TABLE IF NOT EXISTS notifications (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT          NOT NULL,                    -- who receives it
  actor_id    INT          NULL,                        -- who did it (NULL = system message)
  kind        ENUM('like', 'comment', 'reply', 'mention', 'follow', 'save', 'share', 'system') NOT NULL,
  post_id     INT          NULL,
  comment_id  INT          NULL,
  text        VARCHAR(300) NULL,                        -- comment snippet / system message
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at     DATETIME     NULL,
  INDEX idx_user (user_id, id),
  INDEX idx_unread (user_id, read_at),
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (actor_id)   REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (post_id)    REFERENCES posts(id)    ON DELETE CASCADE,
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
);
