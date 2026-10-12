"""HandyHub API server (Flask).

Run locally:  python app.py   →  http://localhost:5050
The Vite dev server proxies /api and /uploads here, so the browser sees one origin.
"""
import os

from dotenv import load_dotenv
from flask import Flask, jsonify, send_from_directory
from werkzeug.exceptions import HTTPException

from db import close_db
from routes import auth_routes, posts_routes, users_routes

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, '.env'))


def create_app(overrides=None):
    app = Flask(__name__)
    app.config.update(
        DB_HOST=os.getenv('DB_HOST', 'localhost'),
        DB_PORT=int(os.getenv('DB_PORT', '3306')),
        DB_USER=os.getenv('DB_USER', 'root'),
        DB_PASSWORD=os.getenv('DB_PASSWORD', ''),
        DB_NAME=os.getenv('DB_NAME', 'handyhub'),
        COOKIE_SECURE=os.getenv('COOKIE_SECURE', '0') == '1',
        UPLOAD_DIR=os.getenv('UPLOAD_DIR', os.path.join(BASE_DIR, 'uploads')),
        MAX_CONTENT_LENGTH=40 * 1024 * 1024,  # whole request (up to 6 images)
        JSON_AS_ASCII=False,
    )
    if overrides:
        app.config.update(overrides)
    os.makedirs(app.config['UPLOAD_DIR'], exist_ok=True)

    app.teardown_appcontext(close_db)
    app.register_blueprint(auth_routes.bp)
    app.register_blueprint(users_routes.bp)
    app.register_blueprint(posts_routes.bp)

    @app.get('/uploads/<path:filename>')
    def uploads(filename):
        return send_from_directory(app.config['UPLOAD_DIR'], filename, max_age=31536000)

    @app.get('/api/health')
    def health():
        return jsonify({'ok': True})

    @app.errorhandler(HTTPException)
    def http_error(e):
        if e.code == 413:
            return jsonify({'error': 'הקבצים גדולים מדי'}), 413
        return jsonify({'error': e.description}), e.code

    return app


if __name__ == '__main__':
    create_app().run(host='127.0.0.1', port=int(os.getenv('PORT', '5050')), debug=True)
