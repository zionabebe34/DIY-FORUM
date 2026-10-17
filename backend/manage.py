"""Admin command line.

    python manage.py set-role <username> admin|moderator|user
    python manage.py unban <username>
"""
import argparse
import os
import sys

from seed import BASE_DIR, connect  # noqa: F401  (connect reads backend/.env)

ROLES = ('user', 'moderator', 'admin')


def main(argv=None):
    """CLI: `set-role <user> <role>` or `unban <user>`. Returns the exit code."""
    parser = argparse.ArgumentParser(description='HandyHub admin commands')
    sub = parser.add_subparsers(dest='command', required=True)
    p_role = sub.add_parser('set-role', help="change a user's role")
    p_role.add_argument('username')
    p_role.add_argument('role', choices=ROLES)
    p_unban = sub.add_parser('unban', help='lift a ban')
    p_unban.add_argument('username')
    args = parser.parse_args(argv)

    conn = connect(os.getenv('DB_NAME', 'handyhub'))
    cur = conn.cursor()
    if args.command == 'set-role':
        cur.execute('UPDATE users SET role = %s WHERE username = %s', (args.role, args.username))
        done = f'{args.username} is now {args.role}'
    else:
        cur.execute('UPDATE users SET is_banned = FALSE, ban_reason = NULL, banned_at = NULL WHERE username = %s',
                    (args.username,))
        done = f'{args.username} is unbanned'
    conn.commit()
    found = cur.rowcount > 0 or _exists(cur, args.username)
    conn.close()
    if not found:
        print(f'No user named {args.username!r}')
        return 1
    print(done)
    return 0


def _exists(cur, username):
    """True if a user with this username exists."""
    cur.execute('SELECT 1 FROM users WHERE username = %s', (username,))
    return bool(cur.fetchall())


if __name__ == '__main__':
    sys.exit(main())
