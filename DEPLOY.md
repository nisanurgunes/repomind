# DevPulse — Deploy Rehberi

## Stack
- **Frontend**: Next.js → Vercel
- **Backend**: FastAPI → Railway
- **Database**: PostgreSQL → Supabase (zaten mevcut)
- **Redis**: Railway Redis eklentisi (Celery için)

---

## 1. Backend — Railway

### Adımlar

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
2. Root dizin olarak `backend/` klasörünü seç
3. Railway otomatik Dockerfile'ı bulur ve build eder

### Redis ekle
Railway dashboard → Add Service → Redis
→ Oluşturulan `REDIS_URL` env var otomatik inject edilir

### Environment Variables (Railway → Variables)
```
DATABASE_URL=postgresql+asyncpg://...   # Supabase → Settings → Database → Connection string
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
SECRET_KEY=...                          # openssl rand -hex 32
FRONTEND_URL=https://your-app.vercel.app
DEBUG=False
```

### GitHub OAuth callback URL'ini güncelle
GitHub → Settings → Developer settings → OAuth Apps → DevPulse
→ Authorization callback URL: `https://your-backend.railway.app/api/auth/callback`

---

## 2. Frontend — Vercel

### Adımlar

1. [vercel.com](https://vercel.com) → New Project → GitHub repo import
2. Framework: **Next.js** (otomatik algılar)
3. Root Directory: `frontend/`
4. Build Command: `npm run build` (otomatik)

### Environment Variables (Vercel → Settings → Environment Variables)
```
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

> ⚠️ `NEXT_PUBLIC_` prefix'i şart — browser'da çalışması için

---

## 3. Veritabanı — Supabase

Supabase zaten kurulu. Sadece connection string'i Railway'e ekle.

Supabase → Settings → Database → Connection string → URI
```
postgresql+asyncpg://postgres:[PASSWORD]@[HOST]:5432/postgres
```

---

## 4. Son kontroller

- [ ] GitHub OAuth callback URL Railway URL'sine güncellendi mi?
- [ ] `NEXT_PUBLIC_API_URL` Vercel'de Railway URL'sini gösteriyor mu?
- [ ] `FRONTEND_URL` Railway'de Vercel URL'sini gösteriyor mu?
- [ ] Supabase DB migration çalıştırıldı mı? (`alembic upgrade head`)
- [ ] İlk deploy sonrası `/health` endpoint'i çalışıyor mu?

---

## Lokal geliştirme

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev

# Celery (opsiyonel)
celery -A app.workers.tasks.celery_app worker --loglevel=info
celery -A app.workers.tasks.celery_app beat --loglevel=info
```
