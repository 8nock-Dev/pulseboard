# Deployment checklist

## Frontend (Vercel)

- Set the project root to `frontend`.
- Build command: `npm run build`; output directory: `dist`.
- Set `VITE_API_URL=https://YOUR_BACKEND_DOMAIN/api`.
- `frontend/vercel.json` preserves SPA routes, including password reset and public status pages.

## Backend

Run the `backend/Dockerfile` on an always-on container host. Set `PORT`, `DATABASE_URL`, `DATABASE_SSL=true` when the hosted PostgreSQL provider requires TLS, `JWT_SECRET`, `FRONTEND_URL`, `APP_URL`, and all SMTP variables. `FRONTEND_URL` and `APP_URL` must be the final HTTPS Vercel origin without a trailing slash.

The service exposes `GET /health` and handles `SIGTERM`/`SIGINT` gracefully. Keep exactly one scheduler replica unless database leasing has been reviewed for the intended scale.

## Secrets

Generate `JWT_SECRET` with at least 32 random bytes. Never commit `.env`, Gmail app passwords, database URLs, or reset tokens.

## Backups

Schedule an encrypted daily PostgreSQL dump and test restoration before launch:

```bash
pg_dump --format=custom "$DATABASE_URL" > pulseboard-$(date +%F).dump
pg_restore --clean --if-exists --dbname="$RESTORE_DATABASE_URL" pulseboard-YYYY-MM-DD.dump
```

Retain at least seven daily backups and keep one copy outside the application server.
