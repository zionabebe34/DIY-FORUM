-- 0002 — index posts.shared_post_id: finding the post a share quotes (and the shares of a post) fast.
-- It was added to the old schema.sql later, so databases created before that never got it.
CREATE INDEX idx_shared ON posts (shared_post_id);
