"""AI kullanım kotası limitleri.

Aylık, plan bazlı sabitler — DB'de değil burada tutuluyor, kod değişikliği
gerektirmeden ayarlanabilir. "generation" = project-analysis + feature-gap +
project-doc'un ortak havuzu; "chat_message" = advisor-chat, ayrı sayaç
(konuşma bazlı farklı kullanım şekli olduğu için tek seferlik üretimlerle
karıştırılmıyor). None = sınırsız.
"""
from app.models.user import PlanType

GENERATION_LIMITS: dict[PlanType, int | None] = {
    PlanType.free: 10,
    PlanType.pro: 500,
    PlanType.enterprise: None,
}

CHAT_MESSAGE_LIMITS: dict[PlanType, int | None] = {
    PlanType.free: 20,
    PlanType.pro: 1000,
    PlanType.enterprise: None,
}

# Organizasyon Pro — üyeler arasında paylaşılan sabit havuz (org büyüklüğünden bağımsız)
ORG_PRO_MONTHLY_GENERATIONS = 200
ORG_PRO_MONTHLY_CHAT_MESSAGES = 500


def get_limit(feature_kind: str, plan: PlanType, is_org: bool = False) -> int | None:
    if is_org:
        if plan != PlanType.pro:
            # Org Free bireysel free limitiyle aynı davranır (henüz havuz yok)
            return GENERATION_LIMITS[PlanType.free] if feature_kind == "generation" else CHAT_MESSAGE_LIMITS[PlanType.free]
        return ORG_PRO_MONTHLY_GENERATIONS if feature_kind == "generation" else ORG_PRO_MONTHLY_CHAT_MESSAGES
    limits = GENERATION_LIMITS if feature_kind == "generation" else CHAT_MESSAGE_LIMITS
    return limits[plan]
