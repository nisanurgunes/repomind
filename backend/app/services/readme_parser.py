import re

# Yaygın teknolojiler — badge'lerde, başlıklarda veya düz metinde geçince yakala
TECH_KEYWORDS: dict[str, list[str]] = {
    # Frontend
    "React": ["react"],
    "Next.js": ["next.js", "nextjs"],
    "Vue": ["vue.js", "vuejs", "vue"],
    "Angular": ["angular"],
    "Svelte": ["svelte"],
    "TypeScript": ["typescript"],
    "JavaScript": ["javascript"],
    "Tailwind CSS": ["tailwindcss", "tailwind css", "tailwind"],
    "Vite": ["vite"],
    # Backend
    "Python": ["python"],
    "FastAPI": ["fastapi"],
    "Django": ["django"],
    "Flask": ["flask"],
    "Node.js": ["node.js", "nodejs"],
    "Express": ["express"],
    "Go": ["golang", " go "],
    "Rust": ["rust"],
    "Java": ["java"],
    "Spring": ["spring boot", "spring"],
    "Ruby on Rails": ["rails", "ruby on rails"],
    "PHP": ["php", "laravel"],
    # Database
    "PostgreSQL": ["postgresql", "postgres"],
    "MySQL": ["mysql"],
    "MongoDB": ["mongodb"],
    "Redis": ["redis"],
    "SQLite": ["sqlite"],
    "Supabase": ["supabase"],
    # DevOps / Cloud
    "Docker": ["docker"],
    "Kubernetes": ["kubernetes", "k8s"],
    "AWS": ["aws", "amazon web services"],
    "GCP": ["gcp", "google cloud"],
    "Azure": ["azure"],
    "GitHub Actions": ["github actions"],
    "Vercel": ["vercel"],
    # AI/ML
    "PyTorch": ["pytorch"],
    "TensorFlow": ["tensorflow"],
    "OpenAI": ["openai", "gpt"],
    "LangChain": ["langchain"],
}


def extract_summary(readme: str) -> str | None:
    """README'nin ilk anlamlı paragrafını özet olarak döndür."""
    # Markdown başlıklarını, badge satırlarını, boş satırları atla
    lines = readme.splitlines()
    paragraphs = []
    current = []

    for line in lines:
        stripped = line.strip()

        # Badge satırı, başlık, HTML tag, kod bloğu → atla
        if (
            not stripped
            or stripped.startswith("#")
            or stripped.startswith("!")  # resim/badge
            or stripped.startswith("<")
            or stripped.startswith("```")
            or stripped.startswith("---")
            or stripped.startswith("===")
            or re.match(r"^\[.*\]\(.*\)$", stripped)  # tek başına link
        ):
            if current:
                paragraphs.append(" ".join(current))
                current = []
            continue

        current.append(stripped)

    if current:
        paragraphs.append(" ".join(current))

    # En az 30 karakter olan ilk paragrafı al
    for p in paragraphs:
        clean = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", p)  # linkleri düzleştir
        clean = re.sub(r"\*+([^*]+)\*+", r"\1", clean)       # bold/italic kaldır
        clean = re.sub(r"`([^`]+)`", r"\1", clean)            # code kaldır
        clean = clean.strip()
        if len(clean) >= 30:
            # 300 karakterde kırp
            return clean[:300] + ("..." if len(clean) > 300 else "")

    return None


def extract_tech_stack(readme: str, repo_topics: list[str] | None = None) -> list[str]:
    """README metninden ve GitHub topics'lerinden teknoloji listesi çıkar."""
    text = readme.lower()
    found: set[str] = set()

    for tech_name, keywords in TECH_KEYWORDS.items():
        for kw in keywords:
            if kw in text:
                found.add(tech_name)
                break

    # GitHub topics'leri de ekle (varsa)
    if repo_topics:
        topic_map = {kw.lower(): name for name, kws in TECH_KEYWORDS.items() for kw in kws}
        for topic in repo_topics:
            normalized = topic.lower().replace("-", " ")
            if normalized in topic_map:
                found.add(topic_map[normalized])
            elif len(topic) > 2:  # kısa topic'leri direkt ekle (örn. "go" değil "rust" gibi)
                # Bilinmeyen ama uzun topic'leri capitalize ederek ekle
                if topic not in {"the", "and", "for", "with"}:
                    pass  # sadece bilinen teknolojileri göster

    # Alfabetik sırala, max 12
    return sorted(found)[:12]


def parse_readme(readme: str | None, repo_topics: list[str] | None = None) -> dict:
    if not readme:
        return {"summary": None, "tech_stack": []}

    return {
        "summary": extract_summary(readme),
        "tech_stack": extract_tech_stack(readme, repo_topics),
    }
