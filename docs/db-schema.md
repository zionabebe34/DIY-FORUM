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
    USERS ||--o{ REPORTS     : "reports (reporter)"
    USERS ||--o{ REPORTS     : "is reported (target_user)"

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
| Report → target | polymorphic | `reports(target_type, target_id)` points at a post, comment or user; `snapshot` keeps the text so a case stays readable after the content is deleted |
| Comment → Replies | one-to-many (self) | `comments.parent_id → comments.id`; one level of nesting (a reply to a reply joins the top-level thread) |

All foreign keys use `ON DELETE CASCADE`, so deleting a user removes their sessions, posts, follows, likes, comments, images and tag links.

## Design notes

- **Passwords** are stored only as bcrypt hashes (`password_hash`).
- **Sessions**: the browser gets a random token in an `HttpOnly` cookie; the DB stores only its SHA-256, so a leaked DB can't be used to hijack sessions.
- **Password reset**: the emailed link carries a random token; only its SHA-256 is stored, it expires after 30 minutes, works once, only the newest link is valid, max 3 emails per hour, and a successful reset deletes all of the user's sessions. `/api/auth/forgot` answers identically for unknown emails.
- **Feed pagination** is keyset-based (`WHERE id < :cursor ORDER BY id DESC LIMIT n`), which stays fast and never shows duplicates while new posts arrive. `idx_author (author_id, id)` serves the per-user feed and the "following" feed.
- **Moderation**: `users.role` (user / moderator / admin) gates the dashboard; banning sets `is_banned`, deletes the user's sessions and hides their content everywhere. Columns added after the first release are applied by `seed.py` (`COLUMN_MIGRATIONS`) without losing data.
- **Timestamps** are stored in UTC; the client renders "time ago".
- **Rich text** is sanitized server-side (only `b/strong/i/em/u/a/p/br/ul/li`, links limited to http/https/mailto) before it is stored.
