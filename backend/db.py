"""MySQL connection pool + small query helpers.

Each request borrows its own connection from the pool (a single shared
connection is not thread-safe) and returns it on teardown.
"""
from flask import current_app, g
from mysql.connector import pooling

_pools = {}


def _pool():
    cfg = current_app.config
    key = (cfg['DB_HOST'], cfg['DB_PORT'], cfg['DB_NAME'])
    if key not in _pools:
        _pools[key] = pooling.MySQLConnectionPool(
            pool_name='handyhub_' + cfg['DB_NAME'],
            pool_size=10,
            pool_reset_session=True,
            host=cfg['DB_HOST'],
            port=cfg['DB_PORT'],
            user=cfg['DB_USER'],
            password=cfg['DB_PASSWORD'],
            database=cfg['DB_NAME'],
            charset='utf8mb4',
            collation='utf8mb4_unicode_ci',
            time_zone='+00:00',
            use_pure=True,
        )
    return _pools[key]


def get_db():
    if 'db' not in g:
        g.db = _pool().get_connection()
    return g.db


def close_db(exception=None):
    db = g.pop('db', None)
    if db is not None:
        if exception is not None:
            db.rollback()
        db.close()


def query(sql, params=(), one=False):
    """Run a SELECT and return dict rows (or a single row / None)."""
    cur = get_db().cursor(dictionary=True)
    cur.execute(sql, params)
    rows = cur.fetchall()
    cur.close()
    return (rows[0] if rows else None) if one else rows


def execute(sql, params=()):
    """Run an INSERT/UPDATE/DELETE (no commit). Returns (lastrowid, rowcount)."""
    cur = get_db().cursor()
    cur.execute(sql, params)
    result = (cur.lastrowid, cur.rowcount)
    cur.close()
    return result


def commit():
    get_db().commit()
