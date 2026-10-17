"""Database migrations: numbered SQL files in backend/migrations/, each applied exactly once, in order.

    python migrate.py            apply every migration that hasn't run yet (creates the database if needed)
    python migrate.py --status   list the migrations and whether each one has run

`schema_migrations` (inside the database) records which files ran. seed.py / start.sh run this on every
start, and so does the server in the cloud — so the same files bring every database (local, tests, RDS)
to the same structure without touching its data.

Writing a migration: add the next number, e.g. `0003_add_city.sql`, with one change. Never edit a file
that has already run somewhere — fix it with a new file. MySQL commits structure changes (CREATE / ALTER)
immediately, so if a file fails halfway it is not recorded and the error says which statement failed.

Databases created before migrations existed (by the old schema.sql + seed.py) are adopted on the first
run: they are brought to exactly the state of 0001 and 0001 is recorded without running it.
"""
import os
import sys

import mysql.connector
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MIGRATIONS_DIR = os.path.join(BASE_DIR, 'migrations')
INITIAL = '0001_initial'
LOCK_NAME = 'handyhub_migrations'
load_dotenv(os.path.join(BASE_DIR, '.env'))


class MigrationError(RuntimeError):
    pass


def connect(database=None):
    return mysql.connector.connect(
        host=os.getenv('DB_HOST', 'localhost'), port=int(os.getenv('DB_PORT', '3306')),
        user=os.getenv('DB_USER', 'root'), password=os.getenv('DB_PASSWORD', ''),
        database=database, charset='utf8mb4', collation='utf8mb4_unicode_ci', time_zone='+00:00', use_pure=True)


def migration_files(directory=MIGRATIONS_DIR):
    """[(version, path)] sorted by number, e.g. ('0002_posts_shared_index', '.../0002_posts_shared_index.sql')."""
    files = sorted(f for f in os.listdir(directory) if f.endswith('.sql') and f[:4].isdigit())
    return [(f[:-4], os.path.join(directory, f)) for f in files]


def statements(path):
    """The SQL statements in a file (whole-line `--` comments removed, split on `;`)."""
    with open(path, encoding='utf-8') as f:
        sql = '\n'.join(line for line in f.read().splitlines() if not line.lstrip().startswith('--'))
    return [s.strip() for s in sql.split(';') if s.strip()]


def _exists(cur, db_name, table, column=None, index=None):
    if index:
        cur.execute('SELECT 1 FROM information_schema.statistics WHERE table_schema = %s AND table_name = %s '
                    'AND index_name = %s LIMIT 1', (db_name, table, index))
    elif column:
        cur.execute('SELECT 1 FROM information_schema.columns WHERE table_schema = %s AND table_name = %s '
                    'AND column_name = %s', (db_name, table, column))
    else:
        cur.execute('SELECT 1 FROM information_schema.tables WHERE table_schema = %s AND table_name = %s',
                    (db_name, table))
    return bool(cur.fetchall())


# What the old seed.py added to existing tables over time (its COLUMN_MIGRATIONS), for adopting old databases
_LEGACY_COLUMNS = [
    ('users', 'role', "ENUM('user', 'moderator', 'admin') NOT NULL DEFAULT 'user'"),
    ('users', 'is_banned', 'BOOLEAN NOT NULL DEFAULT FALSE'),
    ('users', 'ban_reason', 'VARCHAR(300) NULL'),
    ('users', 'banned_at', 'DATETIME NULL'),
    ('posts', 'shared_post_id', 'INT NULL'),
    ('users', 'totp_enabled', 'BOOLEAN NOT NULL DEFAULT FALSE'),
    ('users', 'totp_secret', 'VARCHAR(64) NULL'),
    ('users', 'totp_pending', 'VARCHAR(64) NULL'),
    ('users', 'totp_last_step', 'BIGINT NULL'),
    ('users', 'google_id', 'VARCHAR(64) NULL UNIQUE'),
]


def _adopt_legacy(cur, db_name, directory):
    """Bring a pre-migrations database to exactly the state of 0001 (without touching its data)."""
    initial = dict(migration_files(directory))[INITIAL]
    for stmt in statements(initial):   # tables added after the database was first created
        cur.execute(stmt.replace('CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS ', 1))
    for table, column, definition in _LEGACY_COLUMNS:
        if not _exists(cur, db_name, table, column=column):
            cur.execute(f'ALTER TABLE `{table}` ADD COLUMN `{column}` {definition}')
    cur.execute("""ALTER TABLE notifications MODIFY kind
                   ENUM('like', 'comment', 'reply', 'mention', 'follow', 'save', 'share', 'system') NOT NULL""")
    # 0001 has no idx_shared (0002 adds it); a database made from a late schema.sql already has it
    if _exists(cur, db_name, 'posts', index='idx_shared'):
        cur.execute('DROP INDEX idx_shared ON posts')


def migrate(db_name, directory=MIGRATIONS_DIR, verbose=True, lock_timeout=60):
    """Apply the pending migrations to `db_name` (created if missing). Returns the versions applied."""
    say = print if verbose else (lambda *a, **k: None)
    conn = connect()
    cur = conn.cursor()
    cur.execute(f'CREATE DATABASE IF NOT EXISTS `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci')
    cur.execute(f'USE `{db_name}`')
    # Two servers starting together must not run the same file twice
    cur.execute('SELECT GET_LOCK(%s, %s)', (LOCK_NAME, lock_timeout))
    if cur.fetchone()[0] != 1:
        conn.close()
        raise MigrationError('another process is running the migrations — try again in a minute')
    applied = []
    try:
        cur.execute("""CREATE TABLE IF NOT EXISTS schema_migrations (
                         version    VARCHAR(100) PRIMARY KEY,
                         applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)""")
        cur.execute('SELECT version FROM schema_migrations')
        done = {r[0] for r in cur.fetchall()}
        if not done and _exists(cur, db_name, 'users'):
            _adopt_legacy(cur, db_name, directory)
            cur.execute('INSERT INTO schema_migrations (version) VALUES (%s)', (INITIAL,))
            conn.commit()
            done.add(INITIAL)
            say(f'{db_name}: existing database adopted — {INITIAL} recorded as applied (data untouched)')

        for version, path in migration_files(directory):
            if version in done:
                continue
            for i, stmt in enumerate(statements(path), 1):
                try:
                    cur.execute(stmt)
                except mysql.connector.Error as e:
                    conn.rollback()
                    raise MigrationError(f'{version}: statement {i} failed — {e.msg}\n{stmt[:300]}') from None
            cur.execute('INSERT INTO schema_migrations (version) VALUES (%s)', (version,))
            conn.commit()
            applied.append(version)
            say(f'{db_name}: applied {version}')
        if not applied:
            say(f'{db_name}: up to date ({len(done)} migrations)')
        return applied
    finally:
        cur.execute('SELECT RELEASE_LOCK(%s)', (LOCK_NAME,))
        cur.fetchall()
        conn.close()


def status(db_name, directory=MIGRATIONS_DIR):
    """[(version, applied_at or None)] for every migration file."""
    conn = connect()
    cur = conn.cursor()
    cur.execute('SELECT 1 FROM information_schema.tables WHERE table_schema = %s AND table_name = %s',
                (db_name, 'schema_migrations'))
    done = {}
    if cur.fetchall():
        cur.execute(f'SELECT version, applied_at FROM `{db_name}`.schema_migrations')
        done = dict(cur.fetchall())
    conn.close()
    return [(v, done.get(v)) for v, _ in migration_files(directory)]


def drop_database(db_name):
    conn = connect()
    conn.cursor().execute(f'DROP DATABASE IF EXISTS `{db_name}`')
    conn.close()


if __name__ == '__main__':
    name = os.getenv('DB_NAME', 'handyhub')
    if '--status' in sys.argv:
        for version, at in status(name):
            print(f"{'✓' if at else '·'} {version}" + (f'   ({at:%Y-%m-%d %H:%M} UTC)' if at else '   (pending)'))
    else:
        try:
            migrate(name)
        except MigrationError as e:
            sys.exit(f'Migration failed: {e}')
