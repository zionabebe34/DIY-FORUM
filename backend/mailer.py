"""Outgoing email.

MAIL_BACKEND selects how mail is delivered:
  console  (default) — print the message to the server log; nothing leaves the machine
  smtp               — send through an SMTP server (Gmail: smtp.gmail.com:587 + an app password)
  memory             — keep messages in app.config['MAIL_OUTBOX'] (tests)
"""
import logging
import smtplib
import ssl
import threading
from email.message import EmailMessage

import certifi
from flask import current_app

log = logging.getLogger('handyhub.mail')


def _build(cfg, to, subject, text, html):
    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = cfg['MAIL_FROM'] or cfg['SMTP_USER']
    msg['To'] = to
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype='html')
    return msg


def _send_smtp(cfg, msg):
    try:
        with smtplib.SMTP(cfg['SMTP_HOST'], cfg['SMTP_PORT'], timeout=20) as server:
            # certifi's CA bundle: python.org builds on macOS ship without system certificates
            server.starttls(context=ssl.create_default_context(cafile=certifi.where()))
            server.login(cfg['SMTP_USER'], cfg['SMTP_PASSWORD'].replace(' ', ''))   # Google shows it as 'abcd efgh …'
            server.send_message(msg)
        print(f"[mail] sent to {msg['To']}: {msg['Subject']}", flush=True)
    except Exception as e:  # never crash a request because the mail server is down
        print(f"[mail] FAILED to send to {msg['To']}: {type(e).__name__}: {e}", flush=True)
        log.exception('failed to send mail to %s', msg['To'])


def send_email(to, subject, text, html=None):
    cfg = current_app.config
    backend = cfg['MAIL_BACKEND']
    msg = _build(cfg, to, subject, text, html)
    if backend == 'memory':
        cfg.setdefault('MAIL_OUTBOX', []).append(msg)
    elif backend == 'smtp':
        # Send in the background: the request returns at the same speed whether or
        # not an email is sent, so response timing can't reveal registered addresses.
        threading.Thread(target=_send_smtp, args=(dict(cfg), msg), daemon=True).start()
    else:
        print(f'\n─── EMAIL (MAIL_BACKEND=console) ───\nTo: {to}\nSubject: {subject}\n\n{text}\n────────────────────────────────────\n',
              flush=True)
