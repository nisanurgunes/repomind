# DevPulse 🚀

> GitHub repository health analytics dashboard for developers and companies.

![DevPulse Landing](https://placehold.co/800x400/6366F1/white?text=DevPulse+Dashboard)

## What is DevPulse?

DevPulse analyzes GitHub repositories and produces a **health score (0-100)** based on:

- 📝 **Commit Activity** — How many commits in the last 90 days?
- 🐛 **Issue Response Time** — How fast are issues being closed?
- 🔀 **PR Merge Speed** — How quickly are pull requests merged?
- 👥 **Contributor Count** — How many people contribute?

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Recharts |
| Backend | FastAPI, Python 3.14, SQLAlchemy, Alembic |
| Database | PostgreSQL (Supabase) |
| Auth | GitHub OAuth, JWT |
| Deploy | Vercel (FE), Railway (BE) |

## Features

- 🔐 GitHub OAuth authentication
- 📊 Real-time repository health score
- 📈 Commit activity chart (last 90 days)
- 💾 Watchlist — save and track repositories
- 🔍 Repo detail page with full metrics

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- Git

### 1. Clone the repository

```bash
git clone https://github.com/nisanurgunes/devpulse.git
cd devpulse
```

### 2. Backend setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

Create `.env` file in `backend/`:

```env
APP_NAME=DevPulse
DEBUG=True
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/devpulse
REDIS_URL=redis://localhost:6379
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_TOKEN=your_github_personal_access_token
SECRET_KEY=your_secret_key
ALGORITHM=HS256
```

Run migrations:

```bash
alembic upgrade head
```

Start the server:

```bash
uvicorn app.main:app --reload
```

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

### 4. Open the app

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Tests & CI

Every pull request (and every push to `main` / `staging`) runs the GitHub Actions
workflow in `.github/workflows/ci.yml`:

| Job | Checks |
|-----|--------|
| Backend | `ruff` lint → `alembic upgrade head` on an empty Postgres → `pytest` (unit + API tests) |
| Frontend | `eslint` → `tsc --noEmit` → `next build` |

Run the same checks locally:

```bash
# Backend
cd backend
pip install -r requirements.txt -r requirements-dev.txt
ruff check .
docker compose -f docker-compose.test.yml up -d   # throwaway Postgres on 127.0.0.1:5433
TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/repomind_test pytest

# Frontend
cd frontend
npm run lint:ci && npx tsc --noEmit && npm run build
```

The API tests empty the tables before each test, so they only run against the
database in `TEST_DATABASE_URL` and refuse any host that is not local. Without
`TEST_DATABASE_URL` the database tests are skipped and only the unit tests run.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/repos/analyze` | Analyze a repository |
| GET | `/api/repos/{owner}/{name}` | Get repo details |
| GET | `/api/repos/chart/{owner}/{name}/commits` | Get commit chart data |
| GET | `/api/users/me` | Get current user |
| GET | `/api/users/watchlist` | Get user watchlist |
| POST | `/api/users/watchlist/{id}` | Add repo to watchlist |
| DELETE | `/api/users/watchlist/{id}` | Remove from watchlist |
| GET | `/api/auth/login` | GitHub OAuth login |
| GET | `/api/auth/callback` | GitHub OAuth callback |

## Health Score Algorithm
Health Score = (commit_score × 0.30) +
(issue_score  × 0.25) +
(pr_score     × 0.25) +
(contributor  × 0.20)

Each metric is normalized to 0-100 based on thresholds.

## Project Structure
devpulse/
├── frontend/          # Next.js 14 app
│   └── app/
│       ├── page.tsx           # Landing page
│       ├── dashboard/         # Dashboard
│       ├── auth/callback/     # OAuth callback
│       └── repo/[owner]/[name]/  # Repo detail
└── backend/           # FastAPI app
└── app/
├── api/routes/        # Endpoints
├── core/              # Config, DB, Auth
├── models/            # SQLAlchemy models
└── services/          # GitHub API, Health Score