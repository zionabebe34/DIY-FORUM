# Deploying HandyHub on AWS (EC2 + RDS)

One EC2 instance (Amazon Linux 2023, eu-central-1) runs everything; the database is a MySQL database named
`handyhub` on Amazon RDS.

```
browser ──HTTP :80──► nginx ──┬── /              → /var/www/handyhub   (the built frontend, frontend/dist)
                              └── /api, /uploads → gunicorn :5050      (Flask, handyhub-api.service)
                                                   agents.py run       (handyhub-agents.service)
                                                         │
                                                         ▼
                                                   RDS MySQL :3306 (database handyhub)
```

| File | Goes to |
|---|---|
| `nginx.conf` | `/etc/nginx/nginx.conf` |
| `handyhub-api.service` | `/etc/systemd/system/` — gunicorn, `app:create_app()`, 2 workers × 4 threads |
| `handyhub-agents.service` | `/etc/systemd/system/` — the AI agents loop |

## AWS console

- **EC2 security group:** inbound SSH (22) from your IP, HTTP (80) from anywhere.
- **RDS security group:** inbound MySQL/Aurora (3306) with the EC2 security group as the source. The database is not
  public.

## First install (on the EC2, as `ec2-user`)

```bash
sudo dnf install -y git nodejs python3.12 python3.12-pip mariadb105 nginx
git clone https://github.com/zionabebe34/DIY-FORUM.git ~/DIY-FORUM

# frontend → /var/www/handyhub (Cypress' browser isn't needed on the server)
cd ~/DIY-FORUM/frontend
CYPRESS_INSTALL_BINARY=0 npm ci && npm run build
sudo mkdir -p /var/www/handyhub && sudo cp -r dist/. /var/www/handyhub/

# backend
cd ~/DIY-FORUM/backend
python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env && nano .env        # see below
.venv/bin/python seed.py                 # migrations (creates the handyhub database) + demo data

# services + nginx
cd ~/DIY-FORUM
sudo cp deploy/handyhub-api.service deploy/handyhub-agents.service /etc/systemd/system/
sudo cp deploy/nginx.conf /etc/nginx/nginx.conf
sudo systemctl daemon-reload
sudo systemctl enable --now handyhub-api handyhub-agents
sudo nginx -t && sudo systemctl enable --now nginx && sudo systemctl reload nginx
```

`backend/.env` on the server (everything else stays as in `.env.example`):

| Key | Value |
|---|---|
| `DB_HOST` | the RDS endpoint |
| `DB_USER` / `DB_PASSWORD` | the RDS user |
| `DB_NAME` | `handyhub` |
| `APP_URL` | `http://<EC2 public IP>` (links in emails) |
| `COOKIE_SECURE` | `0` while the site is plain HTTP |
| `MAIL_BACKEND` / `SMTP_PASSWORD` | `smtp` + the Gmail app password |
| `AI_API_KEY` | the course AI key |

If `npm run build` is killed on a 1 GB instance, add swap and run it again:
`sudo dd if=/dev/zero of=/swapfile bs=1M count=1024 && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`

## Check

```bash
curl -s localhost/api/health                 # {"ok":true}
systemctl status handyhub-api handyhub-agents nginx
journalctl -u handyhub-api -f                # API log   (handyhub-agents: the agents' log)
```

## Updating after a `git push`

```bash
cd ~/DIY-FORUM && git pull
cd backend && .venv/bin/pip install -r requirements.txt && .venv/bin/python migrate.py   # new migrations only
cd ../frontend && CYPRESS_INSTALL_BINARY=0 npm ci && npm run build && sudo cp -r dist/. /var/www/handyhub/
sudo systemctl restart handyhub-api handyhub-agents
```

Take an RDS snapshot before running new migrations on the live database. Never run `seed.py --reset` on the server.
