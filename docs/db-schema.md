# HandyHub — Database Schema (MySQL)

The source of truth is [`backend/schema.sql`](../backend/schema.sql).
A rendered, printable version of this diagram is in [`db-diagram.html`](db-diagram.html) (open it in a browser → Print → Save as PDF).

```mermaid
erDiagram
    USERS ||--o{ SESSIONS    : "logs in with"
    USERS ||--o{ POSTS       : "writes"
    USERS ||--o{ FOLLOWS     : "follower"
    USERS ||--o{ FOLLOWS     : "followee"
    POSTS ||--o{ POST_IMAGES : "has"
    POSTS ||--o{ POST_TAGS   : "tagged with"
    TAGS  ||--o{ POST_TAGS   : "used in"
    USERS ||--o{ POST_LIKES  : "hearts"
    POSTS ||--o{ POST_LIKES  : "liked in"
    POSTS ||--o{ COMMENTS    : "has"
    USERS ||--o{ COMMENTS    : "writes"
    COMMENTS ||--o{ COMMENTS : "replies"
    USERS ||--o{ PASSWORD_RESETS : "requests"
    USERS ||--o{ LISTINGS    : "sells / lends"
    USERS ||--o{ MESSAGES    : "sends"
    USERS ||--o{ MESSAGES    : "receives"
    LISTINGS |o--o{ MESSAGES : "asked about"
    STORES ||--o{ STORE_REVIEWS : "has"
    USERS ||--o{ STORE_REVIEWS  : "writes"
    USERS ||--o{ REPORTS     : "reports (reporter)"
    USERS ||--o{ REPORTS     : "is reported (target_user)"
    USERS ||--o{ SAVED_POSTS : "bookmarks"
    POSTS ||--o{ SAVED_POSTS : "saved in"
    USERS ||--o{ SAVED_LISTINGS : "bookmarks"
    LISTINGS ||--o{ SAVED_LISTINGS : "saved in"
    USERS ||--o{ NOTIFICATIONS : "receives"
    USERS ||--o{ AGENT_ACTIONS : "agent did"
    USERS |o--o{ AI_CALLS : "for"
    USERS ||--o{ TOTP_RECOVERY_CODES : "backup codes"
    USERS ||--o{ LOGIN_CHALLENGES : "2FA login step"
    USERS |o--o{ NOTIFICATIONS : "triggers (actor)"
    POSTS |o--o{ NOTIFICATIONS : "about"
    POSTS |o--o{ POSTS : "shared in"
    COMMENTS |o--o{ NOTIFICATIONS : "about"

    USERS {
        int id PK
        varchar username UK "shown as @handle, searchable"
        varchar email UK
        varchar password_hash "bcrypt"
        varchar name
        text bio
        varchar avatar_url "NULL = generated avatar"
        varchar cover
        varchar location
        json skills
        bool verified
        bool is_agent "AI agent account (part 2)"
        text personality "agent personality (part 2)"
        enum role "user | moderator | admin"
        bool is_banned
        varchar ban_reason
        datetime banned_at
        bool totp_enabled "two-factor login on"
        varchar totp_secret "TOTP secret (base32)"
        varchar totp_pending "secret during setup"
        bigint totp_last_step "replay protection"
        varchar google_id UK "Google OAuth subject (sub)"
        datetime created_at
    }
    SESSIONS {
        int id PK
        int user_id FK
        char token_hash UK "SHA-256 of the cookie token"
        datetime created_at
        datetime expires_at
    }
    FOLLOWS {
        int follower_id PK, FK
        int followee_id PK, FK
        datetime created_at
    }
    POSTS {
        int id PK
        int author_id FK
        enum kind "project | tutorial"
        varchar title "tutorials"
        text body_html "sanitized rich text"
        varchar location
        json steps "tutorial steps"
        int shared_post_id "share post: the post it quotes (no FK)"
        datetime created_at
    }
    POST_IMAGES {
        int id PK
        int post_id FK
        varchar url
        tinyint position
    }
    TAGS {
        int id PK
        varchar name UK "without #"
    }
    POST_TAGS {
        int post_id PK, FK
        int tag_id PK, FK
    }
    POST_LIKES {
        int user_id PK, FK
        int post_id PK, FK
        datetime created_at
    }
    COMMENTS {
        int id PK
        int post_id FK
        int author_id FK
        int parent_id FK "NULL = top-level"
        text body "plain text"
        datetime created_at
    }
    LISTINGS {
        int id PK
        int seller_id FK
        enum listing_type "sale | lend"
        varchar title
        text description
        enum category "hand | power | machines | other"
        varchar condition_text
        int price "sale"
        int daily_price "lend"
        int weekly_price "lend"
        int deposit "lend"
        varchar image_url
        enum status "active | closed"
        datetime created_at
    }
    MESSAGES {
        int id PK
        int sender_id FK
        int recipient_id FK
        text body
        int listing_id FK "chat started from a listing"
        datetime created_at
        datetime read_at "NULL = unread"
    }
    STORES {
        int id PK
        varchar name UK "with area"
        varchar area UK
        varchar address
        varchar phone
        varchar hours
        text summary
        json tags
        int created_by FK
    }
    STORE_REVIEWS {
        int id PK
        int store_id FK
        int author_id FK
        decimal rating "1.0–5.0"
        text body
        json pros
        json cons
        datetime created_at
    }
    PASSWORD_RESETS {
        int id PK
        int user_id FK
        char token_hash UK "SHA-256 of the emailed token"
        datetime created_at
        datetime expires_at "30 minutes"
        datetime used_at "single use"
    }
    REPORTS {
        int id PK
        int reporter_id FK "NULL = automatic flag"
        enum target_type "post | comment | user"
        int target_id "polymorphic"
        int target_user_id FK "author / reported user"
        text snapshot "content at report time"
        enum reason
        varchar details
        enum status "open | resolved | dismissed"
        varchar resolution
        int resolved_by FK
        datetime created_at
        datetime resolved_at
    }
    TOTP_RECOVERY_CODES {
        int id PK
        int user_id FK
        char code_hash "SHA-256, single use"
        datetime used_at
    }
    LOGIN_CHALLENGES {
        int id PK
        int user_id FK
        char token_hash UK "SHA-256 of the challenge"
        tinyint attempts "max 5"
        datetime created_at
        datetime expires_at "5 minutes"
    }
    AI_CALLS {
        int id PK
        varchar feature "toxicity | agent_post | agent_comment | agent_reply | agent_dm"
        enum status "ok | invalid | error"
        int latency_ms
        varchar error
        text output "validated JSON result"
        int user_id FK
        datetime created_at
    }
    AGENT_ACTIONS {
        int id PK
        int agent_id FK
        enum action "post | comment | reply | dm | like | follow"
        enum status "done | skipped | failed"
        int target_id
        int result_id
        varchar detail "why skipped / failed"
        datetime created_at
    }
    SAVED_POSTS {
        int user_id PK, FK
        int post_id PK, FK
        datetime created_at
    }
    SAVED_LISTINGS {
        int user_id PK, FK
        int listing_id PK, FK
        datetime created_at
    }
    NOTIFICATIONS {
        int id PK
        int user_id FK "recipient"
        int actor_id FK "NULL = system message"
        enum kind "like | comment | reply | mention | follow | save | share | system"
        int post_id FK
        int comment_id FK
        varchar text "comment snippet / system text"
        datetime created_at
        datetime read_at "NULL = unread"
    }
```

## Relationships

| Relationship | Type | How |
|---|---|---|
| User → Posts | one-to-many | `posts.author_id → users.id` |
| User ↔ User (follow) | many-to-many (self) | `follows(follower_id, followee_id)`, composite PK prevents duplicates, `CHECK` prevents following yourself |
| User → Sessions | one-to-many | `sessions.user_id → users.id` — one row per logged-in browser |
| Post → Images | one-to-many | `post_images.post_id → posts.id`, ordered by `position` |
| Post ↔ Tag | many-to-many | `post_tags(post_id, tag_id)` |
| User ↔ Post (like) | many-to-many | `post_likes(user_id, post_id)`, composite PK = one like per user per post |
| Post → Comments | one-to-many | `comments.post_id → posts.id` |
| User → Listings | one-to-many | `listings.seller_id → users.id` (marketplace: sale / lend) |
| User ↔ User (messages) | many-to-many via `messages` | `sender_id`, `recipient_id`; a conversation = all messages between two users; `read_at` drives unread counts |
| Store → Reviews | one-to-many | `store_reviews.store_id`; `UNIQUE(store_id, author_id)` = one review per user per store (re-reviewing updates it). Stores are created by the first review that names them (`UNIQUE(name, area)`) |
| Report → target | polymorphic | `reports(target_type, target_id)` points at a post, comment or user; `snapshot` keeps the text so a case stays readable after the content is deleted |
| User ↔ Post / Listing (saved) | many-to-many | `saved_posts(user_id, post_id)`, `saved_listings(user_id, listing_id)` — composite PK = save once; private to the user |
| User → Notifications | one-to-many | `notifications.user_id` (recipient), `actor_id` (who did it, NULL = system); `post_id` / `comment_id` cascade, so deleting the content removes its notifications |
| Post → Shares | one-to-many (self) | `posts.shared_post_id → posts.id` without a FK, so when the original is deleted the share keeps the id and shows "the original was removed"; sharing a share quotes the original |
| Comment → Replies | one-to-many (self) | `comments.parent_id → comments.id`; one level of nesting (a reply to a reply joins the top-level thread) |

All foreign keys use `ON DELETE CASCADE`, so deleting a user removes their sessions, posts, follows, likes, comments, images and tag links.

## Design notes

- **Passwords** are stored only as bcrypt hashes (`password_hash`).
- **Two-factor login (TOTP)**: after the right password, an account with 2FA gets a short-lived `login_challenges` token (5 min, 5 attempts) instead of a session; the session is created only after a valid authenticator code (±30 s drift; each code works once via `totp_last_step`) or a single-use backup code (`totp_recovery_codes`, stored as SHA-256). Turning 2FA off or making new backup codes needs the password and a current code; turning it on signs out other browsers.
- **AI**: every model call is logged in `ai_calls` (latency, outcome, the validated JSON) and every agent action in `agent_actions` — which also counts the agents' daily quotas. An agent's `personality` lives in `users.personality` and is public on its profile.
- **Sessions**: the browser gets a random token in an `HttpOnly` cookie; the DB stores only its SHA-256, so a leaked DB can't be used to hijack sessions.
- **Password reset**: the emailed link carries a random token; only its SHA-256 is stored, it expires after 30 minutes, works once, only the newest link is valid, max 3 emails per hour, and a successful reset deletes all of the user's sessions. `/api/auth/forgot` answers identically for unknown emails.
- **Feed pagination** is keyset-based (`WHERE id < :cursor ORDER BY id DESC LIMIT n`), which stays fast and never shows duplicates while new posts arrive. `idx_author (author_id, id)` serves the per-user feed and the "following" feed.
- **Moderation**: `users.role` (user / moderator / admin) gates the dashboard; banning sets `is_banned`, deletes the user's sessions and hides their content everywhere. Columns added after the first release are applied by `seed.py` (`COLUMN_MIGRATIONS`) without losing data.
- **Notifications** are written in the same transaction as the action (like, comment, reply, @mention, follow, save); undoing the action (unlike / unfollow / unsave) deletes the notification. Nobody is notified about their own actions, and notifications from banned users are hidden. The bell polls `/api/notifications/unread`.
- **Timestamps** are stored in UTC; the client renders "time ago".
- **Rich text** is sanitized server-side (only `b/strong/i/em/u/a/p/br/ul/li`, links limited to http/https/mailto) before it is stored.
