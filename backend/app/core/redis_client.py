import redis.asyncio as redis
from app.core.config import settings

_redis_client: redis.Redis | None = None


def get_redis() -> redis.Redis:
    """AI kullanım kotası sayaçları için paylaşılan Redis client — Celery'nin
    kullandığı REDIS_URL'i tekrar kullanır, yeni bir bağlantı türü eklemez."""
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis_client
