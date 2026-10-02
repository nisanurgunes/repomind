import pytest
import redis.exceptions

from app.core import billing
from app.core.billing import BillingContext, QuotaExceededError, check_and_consume_quota
from app.core.quota_limits import get_limit
from app.models.user import PlanType


class FakeRedis:
    def __init__(self, start: int = 0, fail: bool = False):
        self.count = start
        self.fail = fail
        self.expired_keys: list[str] = []

    async def incr(self, key: str) -> int:
        if self.fail:
            raise redis.exceptions.ConnectionError("redis down")
        self.count += 1
        return self.count

    async def expire(self, key: str, ttl: int) -> None:
        self.expired_keys.append(key)


@pytest.mark.parametrize(
    "feature_kind, plan, is_org, expected",
    [
        ("generation", PlanType.free, False, 10),
        ("generation", PlanType.pro, False, 500),
        ("generation", PlanType.enterprise, False, None),
        ("chat_message", PlanType.free, False, 20),
        ("chat_message", PlanType.pro, False, 1000),
        ("generation", PlanType.pro, True, 200),
        ("chat_message", PlanType.pro, True, 500),
        # Org Free, bireysel free limitiyle aynı davranır
        ("generation", PlanType.free, True, 10),
        ("chat_message", PlanType.free, True, 20),
    ],
)
def test_get_limit(feature_kind, plan, is_org, expected):
    assert get_limit(feature_kind, plan, is_org=is_org) == expected


async def test_quota_allows_requests_up_to_the_limit(monkeypatch):
    fake = FakeRedis(start=9)
    monkeypatch.setattr(billing, "get_redis", lambda: fake)
    ctx = BillingContext("user", "user-1", PlanType.free)

    assert await check_and_consume_quota("generation", ctx) is True


async def test_quota_raises_when_limit_is_exceeded(monkeypatch):
    fake = FakeRedis(start=10)
    monkeypatch.setattr(billing, "get_redis", lambda: fake)
    ctx = BillingContext("user", "user-1", PlanType.free)

    with pytest.raises(QuotaExceededError) as exc:
        await check_and_consume_quota("generation", ctx)

    assert exc.value.limit == 10
    assert exc.value.feature_kind == "generation"
    assert exc.value.owner_type == "user"


async def test_first_use_in_a_month_sets_expiry_on_the_counter(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr(billing, "get_redis", lambda: fake)
    ctx = BillingContext("org", "42", PlanType.pro)

    await check_and_consume_quota("chat_message", ctx)
    await check_and_consume_quota("chat_message", ctx)

    assert len(fake.expired_keys) == 1
    assert fake.expired_keys[0].startswith("quota:org:42:chat_message:")


async def test_quota_fails_open_when_redis_is_down(monkeypatch):
    monkeypatch.setattr(billing, "get_redis", lambda: FakeRedis(fail=True))
    ctx = BillingContext("user", "user-1", PlanType.free)

    assert await check_and_consume_quota("generation", ctx) is True


async def test_unlimited_plan_never_touches_redis(monkeypatch):
    def _no_redis():
        raise AssertionError("sınırsız planda Redis'e gidilmemeli")

    monkeypatch.setattr(billing, "get_redis", _no_redis)
    ctx = BillingContext("user", "user-1", PlanType.enterprise)

    assert await check_and_consume_quota("generation", ctx) is True
