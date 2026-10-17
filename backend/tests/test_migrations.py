"""migrate.py — fresh databases, re-runs, adopting a pre-migrations database, failures, new files, the lock."""
import os
import runpy
import shutil

import pytest

import migrate
from migrate import INITIAL, MigrationError, connect, drop_database, migration_files, statements
from tests.conftest import TEST_DB

FRESH, LEGACY = TEST_DB + '_mig_fresh', TEST_DB + '_mig_legacy'
ALL = [v for v, _ in migration_files()]


@pytest.fixture
def dbs():
    for name in (FRESH, LEGACY):
        drop_database(name)
    yield
    for name in (FRESH, LEGACY):
        drop_database(name)


def run_sql(db, *sql, params=()):
    conn = connect(db)
    cur = conn.cursor()
    rows = None
    for s in sql:
        cur.execute(s, params)
        rows = cur.fetchall() if cur.with_rows else rows
    conn.commit()
    conn.close()
    return rows


def recorded(db):
    return [r[0] for r in run_sql(db, 'SELECT version FROM schema_migrations ORDER BY version')]


def tables(db):
    return {r[0] for r in run_sql('information_schema', 'SELECT table_name FROM tables WHERE table_schema = %s',
                                  params=(db,))}


def has_index(db, table, index):
    return bool(run_sql('information_schema', 'SELECT 1 FROM statistics WHERE table_schema = %s AND table_name = %s '
                        'AND index_name = %s', params=(db, table, index)))


def structure(db):
    """Columns + indexes of every table (order-independent) — to compare two databases."""
    cols = run_sql('information_schema', """SELECT table_name, column_name, column_type, is_nullable, column_default
                                            FROM columns WHERE table_schema = %s""", params=(db,))
    idx = run_sql('information_schema', """SELECT table_name, index_name, non_unique,
                                                  GROUP_CONCAT(column_name ORDER BY seq_in_index)
                                           FROM statistics WHERE table_schema = %s
                                           GROUP BY table_name, index_name, non_unique""", params=(db,))
    return set(cols), set(idx)


def make_legacy(db, with_shared_index=False):
    """A database as the old schema.sql + seed.py left it: no schema_migrations, an older notifications enum,
    some columns / tables added later missing — plus real data."""
    run_sql('information_schema', f'CREATE DATABASE `{db}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci')
    run_sql(db, *statements(dict(migration_files())[INITIAL]))
    run_sql(db, 'ALTER TABLE users DROP COLUMN google_id', 'ALTER TABLE users DROP COLUMN totp_last_step',
            'DROP TABLE agent_actions', 'DROP TABLE ai_calls',
            "ALTER TABLE notifications MODIFY kind ENUM('like', 'comment', 'reply', 'mention', 'follow', 'save', 'system') NOT NULL")
    if with_shared_index:
        run_sql(db, 'CREATE INDEX idx_shared ON posts (shared_post_id)')
    run_sql(db, "INSERT INTO users (username, email, password_hash, name) VALUES ('old', 'old@x.co', 'h', 'Old User')",
            "INSERT INTO posts (author_id, body_html) VALUES (1, '<p>kept</p>')")


def test_fresh_database(dbs):
    assert migrate.migrate(FRESH, verbose=False) == ALL
    assert recorded(FRESH) == ALL
    assert len(tables(FRESH)) == 23                       # 22 app tables + schema_migrations
    assert has_index(FRESH, 'posts', 'idx_shared')        # 0002
    assert migrate.migrate(FRESH, verbose=False) == []    # a second run changes nothing
    assert [at is not None for _, at in migrate.status(FRESH)] == [True] * len(ALL)


def test_adopting_a_pre_migrations_database(dbs, capsys):
    make_legacy(LEGACY)
    assert migrate.status(LEGACY) == [(v, None) for v in ALL]          # nothing recorded yet
    assert migrate.migrate(LEGACY) == ['0002_posts_shared_index']       # 0001 only recorded, not run
    assert 'adopted' in capsys.readouterr().out
    assert recorded(LEGACY) == ALL
    # the data is untouched, and the structure is exactly what migrations build on an empty database
    assert run_sql(LEGACY, 'SELECT username FROM users') == [('old',)]
    assert run_sql(LEGACY, 'SELECT body_html FROM posts') == [('<p>kept</p>',)]
    migrate.migrate(FRESH, verbose=False)
    assert structure(LEGACY) == structure(FRESH)


def test_adopting_a_database_that_already_had_the_index(dbs):
    make_legacy(LEGACY, with_shared_index=True)
    assert migrate.migrate(LEGACY, verbose=False) == ['0002_posts_shared_index']
    assert has_index(LEGACY, 'posts', 'idx_shared')


def test_failing_and_new_migrations(dbs, tmp_path):
    folder = tmp_path / 'migrations'
    shutil.copytree(migrate.MIGRATIONS_DIR, folder)
    (folder / 'notes.txt').write_text('not a migration')
    migrate.migrate(FRESH, directory=str(folder), verbose=False)

    # a broken file stops the run, says which statement failed, and is not recorded
    (folder / '0003_add_city.sql').write_text('-- comment; with a semicolon\nALTER TABLE nope ADD COLUMN city INT;')
    with pytest.raises(MigrationError, match=r'0003_add_city: statement 1 failed') as e:
        migrate.migrate(FRESH, directory=str(folder), verbose=False)
    assert 'ALTER TABLE nope' in str(e.value)
    assert '0003_add_city' not in recorded(FRESH)

    # fixed → only the new file runs
    (folder / '0003_add_city.sql').write_text('ALTER TABLE users ADD COLUMN city VARCHAR(80) NULL;\n')
    assert migrate.migrate(FRESH, directory=str(folder), verbose=False) == ['0003_add_city']
    assert run_sql('information_schema', "SELECT 1 FROM columns WHERE table_schema = %s AND table_name = 'users' "
                   "AND column_name = 'city'", params=(FRESH,)) == [(1,)]


def test_one_process_at_a_time(dbs):
    holder = connect()
    cur = holder.cursor()
    cur.execute('SELECT GET_LOCK(%s, 0)', (migrate.LOCK_NAME,))
    cur.fetchall()
    try:
        with pytest.raises(MigrationError, match='another process'):
            migrate.migrate(FRESH, verbose=False, lock_timeout=0)
    finally:
        holder.close()
    assert migrate.migrate(FRESH, verbose=False) == ALL       # free again


def test_command_line(dbs, monkeypatch, capsys):
    path = os.path.join(os.path.dirname(migrate.__file__), 'migrate.py')
    monkeypatch.setenv('DB_NAME', FRESH)
    monkeypatch.setattr('sys.argv', ['migrate.py', '--status'])
    runpy.run_path(path, run_name='__main__')
    assert '· 0001_initial   (pending)' in capsys.readouterr().out
    monkeypatch.setattr('sys.argv', ['migrate.py'])
    runpy.run_path(path, run_name='__main__')
    assert 'applied 0002_posts_shared_index' in capsys.readouterr().out
    monkeypatch.setattr('sys.argv', ['migrate.py', '--status'])
    runpy.run_path(path, run_name='__main__')
    assert '✓ 0002_posts_shared_index' in capsys.readouterr().out
