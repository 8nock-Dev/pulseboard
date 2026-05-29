# 📡 PulseBoard

**Self-hosted uptime monitoring with real-time alerts and public status pages.**

PulseBoard monitors your HTTP services, APIs, and websites on a configurable schedule, notifies you the moment something goes down, and gives you a public status page to share with your users — all running on your own infrastructure with no third-party subscription required.

![Dashboard Preview](https://via.placeholder.com/900x500/F7F5F0/1C1917?text=PulseBoard+Dashboard)

---

## Features

- **Uptime monitoring** — HTTP checks on 1, 5, 10, 15, 30, or 60-minute intervals
- **Real-time dashboard** — Live status updates via Server-Sent Events; no manual refresh needed
- **Instant alerts** — Email and webhook (Slack, Discord, custom) notifications on status changes
- **Public status pages** — Shareable `/status/:userId` page for your users
- **90-day uptime bar** — Visual daily uptime history like GitHub's contribution graph
- **Response time charts** — Last 100 check results plotted over time
- **Incident tracking** — Automatic incident open/resolve with duration tracking
- **Self-hosted** — Runs on any VPS, Railway, Render, or Fly.io; no vendor lock-in

---

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Backend    | Node.js 20, Express 4               |
| Database   | PostgreSQL 16                       |
| Frontend   | React 18, Vite, Tailwind CSS        |
| Charts     | Recharts                            |
| Real-time  | Server-Sent Events (SSE)            |
| Scheduling | node-cron                           |
| Auth       | JWT (jsonwebtoken + bcrypt)         |
| Email      | Nodemailer (SMTP)                   |
| Deploy     | Docker + Docker Compose             |

---

## Project Structure

```
pulseboard/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js          # PostgreSQL pool + auto-migration
│   │   │   └── mailer.js      # Nodemailer SMTP transport
│   │   ├── middleware/
│   │   │   └── auth.js        # JWT verification (header + query param for SSE)
│   │   ├── routes/
│   │   │   ├── auth.js        # Register, login, /me
│   │   │   ├── monitors.js    # Full CRUD + checks/daily-uptime/incidents
│   │   │   ├── incidents.js   # Cross-monitor incident feed
│   │   │   ├── status.js      # Public status page API (no auth)
│   │   │   └── sse.js         # Server-Sent Events stream
│   │   ├── services/
│   │   │   ├── checker.js     # HTTP check logic + incident management
│   │   │   ├── scheduler.js   # node-cron task registry
│   │   │   ├── alerting.js    # Email + webhook alert dispatch
│   │   │   └── events.js      # In-memory SSE client registry
│   │   └── app.js             # Express app entry point
│   ├── migrations/
│   │   └── 001_initial.sql    # Full schema (auto-applied on startup)
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js      # Axios instance with JWT interceptors
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── components/
│   │   │   ├── Header.jsx
│   │   │   ├── MonitorCard.jsx
│   │   │   ├── MonitorModal.jsx   # Add/edit form with tabs
│   │   │   ├── UptimeBar.jsx      # 90-day daily uptime visualization
│   │   │   └── ResponseChart.jsx  # Recharts response time area chart
│   │   ├── pages/
│   │   │   ├── Login.jsx          # Login + register (split-panel)
│   │   │   ├── Dashboard.jsx      # Monitor list with live SSE updates
│   │   │   ├── MonitorDetail.jsx  # Charts, checks table, incidents
│   │   │   └── StatusPage.jsx     # Public shareable status page
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── docker-compose.yml
└── README.md
```

---

## Quick Start (Local Development)

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ **OR** Docker

---

### Option A — Docker (recommended, zero config)

```bash
# 1. Clone the repo
git clone https://github.com/yourusername/pulseboard.git
cd pulseboard

# 2. Start the database and backend
docker compose up -d db backend

# 3. Install and run the frontend dev server
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** — register an account and add your first monitor.

---

### Option B — Manual setup

**1. Database**

```bash
# Create a local PostgreSQL database
createdb pulseboard

# Or with psql:
psql -U postgres -c "CREATE DATABASE pulseboard;"
```

**2. Backend**

```bash
cd backend

# Copy and fill in environment variables
cp .env.example .env
# Edit .env — set DATABASE_URL and JWT_SECRET at minimum

npm install
npm run dev
# → Running on http://localhost:3001
```

The backend auto-applies `migrations/001_initial.sql` on startup — no separate migration step needed.

**3. Frontend**

```bash
cd frontend

cp .env.example .env
# VITE_API_URL is optional in development — Vite proxies /api to localhost:3001

npm install
npm run dev
# → Running on http://localhost:5173
```

---

## Environment Variables

### Backend (`.env`)

| Variable               | Required | Description                                      |
|------------------------|----------|--------------------------------------------------|
| `DATABASE_URL`         | ✅        | PostgreSQL connection string                     |
| `JWT_SECRET`           | ✅        | Long random string for signing tokens            |
| `PORT`                 | —         | HTTP port (default: `3001`)                      |
| `FRONTEND_URL`         | —         | CORS origin (default: `http://localhost:5173`)   |
| `APP_URL`              | —         | Used in alert email links                        |
| `SMTP_HOST`            | —         | SMTP server (leave blank to disable email)       |
| `SMTP_PORT`            | —         | SMTP port (default: `587`)                       |
| `SMTP_SECURE`          | —         | `true` for port 465, `false` otherwise           |
| `SMTP_USER`            | —         | SMTP username / email                            |
| `SMTP_PASS`            | —         | SMTP password or app password                    |
| `SMTP_FROM`            | —         | From address shown in alerts                     |

### Frontend (`.env`)

| Variable        | Required | Description                                              |
|-----------------|----------|----------------------------------------------------------|
| `VITE_API_URL`  | —         | Backend URL in production (e.g. `https://api.yourdomain.com/api`) |

---

## API Reference

### Auth
| Method | Endpoint              | Auth | Description          |
|--------|-----------------------|------|----------------------|
| POST   | `/api/auth/register`  | —    | Create account       |
| POST   | `/api/auth/login`     | —    | Get JWT token        |
| GET    | `/api/auth/me`        | ✅   | Current user info    |

### Monitors
| Method | Endpoint                           | Auth | Description               |
|--------|------------------------------------|------|---------------------------|
| GET    | `/api/monitors`                    | ✅   | List all monitors         |
| POST   | `/api/monitors`                    | ✅   | Create monitor            |
| GET    | `/api/monitors/:id`                | ✅   | Get single monitor        |
| PUT    | `/api/monitors/:id`                | ✅   | Update monitor            |
| DELETE | `/api/monitors/:id`                | ✅   | Delete monitor            |
| GET    | `/api/monitors/:id/checks`         | ✅   | Check history             |
| GET    | `/api/monitors/:id/daily-uptime`   | ✅   | 90-day daily uptime       |
| GET    | `/api/monitors/:id/incidents`      | ✅   | Incident history          |

### Real-time & Public
| Method | Endpoint              | Auth         | Description                    |
|--------|-----------------------|--------------|--------------------------------|
| GET    | `/api/events`         | ?token=JWT   | SSE stream for live updates    |
| GET    | `/api/status/:userId` | —            | Public status page data        |
| GET    | `/api/incidents`      | ✅           | All incidents across monitors  |

---

## Deployment

### Railway (recommended for solo projects)

```bash
# Deploy backend
railway new
railway add postgresql
railway up --service backend

# Set environment variables in Railway dashboard
# Deploy frontend to Vercel or as a Railway static site
```

### Render

1. Create a **Web Service** for the backend (`backend/` directory, `npm start`)
2. Create a **PostgreSQL** database and link it via `DATABASE_URL`
3. Deploy frontend as a **Static Site** (`frontend/dist` after `npm run build`)

### Fly.io

```bash
cd backend
fly launch
fly secrets set JWT_SECRET=your_secret DATABASE_URL=your_db_url
fly deploy
```

### VPS (Ubuntu/Debian)

```bash
# On your server
git clone https://github.com/yourusername/pulseboard.git
cd pulseboard
docker compose up -d

# Frontend — build and serve with Nginx
cd frontend && npm install && npm run build
# Copy dist/ to Nginx root and configure reverse proxy to localhost:3001
```

---

## How It Works

1. **Monitor created** → immediately scheduled via `node-cron` and first check runs in background
2. **Each check** → axios GET with timeout → result recorded in `checks` table
3. **Status change** → incident opened/closed → alert dispatched via email + webhook
4. **SSE stream** → every check result is pushed to connected browser tabs via `EventSource`
5. **Uptime %** → recalculated from last 30 days of checks after every run
6. **Public status** → `/api/status/:userId` serves aggregated data without auth

---

## License

MIT — free to use, modify, and deploy.

---

*Built with Node.js, React, and PostgreSQL. Inspired by UptimeRobot and Better Uptime.*
