from app.services.readme_parser import extract_summary, extract_tech_stack, parse_readme


def test_parse_readme_handles_missing_readme():
    assert parse_readme(None) == {"summary": None, "tech_stack": []}
    assert parse_readme("") == {"summary": None, "tech_stack": []}


def test_summary_skips_headings_badges_and_html():
    readme = "\n".join([
        "# My Project",
        "![build](https://img.shields.io/badge/build-passing-green)",
        "<p align='center'>logo</p>",
        "",
        "A small tool that analyzes repository health for teams.",
        "",
        "## Install",
    ])

    assert extract_summary(readme) == "A small tool that analyzes repository health for teams."


def test_summary_strips_markdown_formatting():
    readme = "This is a **bold** and `inline code` text with a [link](https://example.com) inside."

    assert extract_summary(readme) == "This is a bold and inline code text with a link inside."


def test_summary_skips_too_short_paragraphs():
    readme = "Short line.\n\nThis second paragraph is long enough to be used as the summary."

    assert extract_summary(readme) == "This second paragraph is long enough to be used as the summary."


def test_summary_is_truncated_to_300_chars():
    summary = extract_summary("word " * 100)

    assert summary is not None
    assert summary.endswith("...")
    assert len(summary) == 303


def test_summary_is_none_without_a_meaningful_paragraph():
    assert extract_summary("# Title\n\nToo short.") is None


def test_tech_stack_is_detected_case_insensitively_and_sorted():
    readme = "Built with FASTAPI, PostgreSQL and next.js. Deployed with Docker."

    assert extract_tech_stack(readme) == ["Docker", "FastAPI", "Next.js", "PostgreSQL"]


def test_tech_stack_includes_known_github_topics():
    assert extract_tech_stack("No technologies mentioned here.", ["redis", "ruby-on-rails", "misc"]) == [
        "Redis",
        "Ruby on Rails",
    ]


def test_tech_stack_is_capped_at_12_items():
    readme = (
        "react vue angular svelte typescript javascript python django flask rust "
        "docker kubernetes redis mongodb mysql sqlite"
    )

    assert len(extract_tech_stack(readme)) == 12
