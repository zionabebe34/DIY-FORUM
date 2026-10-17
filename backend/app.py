"""HandyHub API server (Flask).

Run locally:  python app.py   →  http://localhost:5050
The Vite dev server proxies /api and /uploads here, so the browser sees one origin.
"""
import os

from dotenv import load_dotenv
from flask import Flask, jsonify, send_from_directory
from werkzeug.exceptions import HTTPException

from db import close_db
from routes import (assist_routes, auth_routes, interactions_routes, market_routes, messages_routes, moderation_routes,
                    notifications_routes, posts_routes, saved_routes, stores_routes, twofa_routes, users_routes)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, '.env'))


def create_app(overrides=None):
    """Build the Flask app: config from .env, all blueprints, /uploads, /api/health and JSON error replies."""
    app = Flask(__name__)
    app.config.update(
        DB_HOST=os.getenv('DB_HOST', 'localhost'),
        DB_PORT=int(os.getenv('DB_PORT', '3306')),
        DB_USER=os.getenv('DB_USER', 'root'),
        DB_PASSWORD=os.getenv('DB_PASSWORD', ''),
        DB_NAME=os.getenv('DB_NAME', 'handyhub'),
        COOKIE_SECURE=os.getenv('COOKIE_SECURE', '0') == '1',
        APP_URL=os.getenv('APP_URL', 'http://localhost:5173').rstrip('/'),   # used in emailed links
        MAIL_BACKEND=os.getenv('MAIL_BACKEND', 'console'),
        MAIL_FROM=os.getenv('MAIL_FROM', ''),
        MAIL_FILE_DIR=os.getenv('MAIL_FILE_DIR', os.path.join(BASE_DIR, 'mail_outbox')),   # MAIL_BACKEND=file
        SMTP_HOST=os.getenv('SMTP_HOST', 'smtp.gmail.com'),
        SMTP_PORT=int(os.getenv('SMTP_PORT', '587')),
        SMTP_USER=os.getenv('SMTP_USER', ''),
        SMTP_PASSWORD=os.getenv('SMTP_PASSWORD', ''),
        UPLOAD_DIR=os.getenv('UPLOAD_DIR', os.path.join(BASE_DIR, 'uploads')),
        GOOGLE_CLIENT_ID=os.getenv('GOOGLE_CLIENT_ID', ''),
        GOOGLE_CLIENT_SECRET=os.getenv('GOOGLE_CLIENT_SECRET', ''),
        # AI: the course's AI service (API Gateway → Bedrock). AI_PROVIDER=off disables every AI feature.
        AI_PROVIDER=os.getenv('AI_PROVIDER', 'off'),
        AI_API_URL=os.getenv('AI_API_URL', ''),
        AI_API_KEY=os.getenv('AI_API_KEY', ''),
        # Autonomous agents (agents.py): on/off and per-agent daily quotas
        AI_ASSIST_PER_HOUR=int(os.getenv('AI_ASSIST_PER_HOUR', '30')),   # writing-assistant calls per user
        # The course AI key has a daily quota: never use more than AI_DAILY_BUDGET calls a day (0 = no cap),
        # and leave people's features a reserve — the agents get at most AI_AGENT_SHARE of it.
        AI_DAILY_BUDGET=int(os.getenv('AI_DAILY_BUDGET', '100')),
        AI_AGENT_SHARE=float(os.getenv('AI_AGENT_SHARE', '0.5')),
        AGENTS_ENABLED=os.getenv('AGENTS_ENABLED', '1') == '1',
        AGENT_MAX_POSTS=int(os.getenv('AGENT_MAX_POSTS', '3')),
        AGENT_MAX_COMMENTS=int(os.getenv('AGENT_MAX_COMMENTS', '5')),
        AGENT_MAX_DMS=int(os.getenv('AGENT_MAX_DMS', '3')),
        AGENT_TICK_SECONDS=int(os.getenv('AGENT_TICK_SECONDS', '600')),
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
    app.register_blueprint(interactions_routes.bp)
    app.register_blueprint(moderation_routes.bp)
    app.register_blueprint(market_routes.bp)
    app.register_blueprint(stores_routes.bp)
    app.register_blueprint(messages_routes.bp)
    app.register_blueprint(notifications_routes.bp)
    app.register_blueprint(saved_routes.bp)
    app.register_blueprint(twofa_routes.bp)
    app.register_blueprint(assist_routes.bp)

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
