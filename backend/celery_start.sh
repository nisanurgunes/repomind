#!/bin/bash
# Worker + Beat'i ayrı terminallerde çalıştır

# Terminal 1 — Worker (task'ları işler)
# celery -A app.workers.tasks.celery_app worker --loglevel=info

# Terminal 2 — Beat (zamanlanmış görevleri tetikler)
# celery -A app.workers.tasks.celery_app beat --loglevel=info

echo "Worker için:"
echo "  celery -A app.workers.tasks.celery_app worker --loglevel=info"
echo ""
echo "Beat (zamanlayıcı) için:"
echo "  celery -A app.workers.tasks.celery_app beat --loglevel=info"
echo ""
echo "Manuel tetiklemek için Python'da:"
echo "  from app.workers.tasks import refresh_watchlist_repos"
echo "  refresh_watchlist_repos.delay()"
