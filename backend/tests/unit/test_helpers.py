import pytest

from app.api.routes.auth import _clean, _oauth_redirect_uri
from app.api.routes.orgs import slugify


@pytest.mark.parametrize(
    "name, expected",
    [
        ("Acme Inc", "acme-inc"),
        ("  Acme   Team  ", "acme-team"),
        ("Acme_Team--Dev", "acme-team-dev"),
        ("Acme & Co!", "acme-co"),
    ],
)
def test_slugify(name, expected):
    assert slugify(name) == expected


def test_slugify_is_capped_at_50_chars():
    assert len(slugify("a" * 80)) == 50


@pytest.mark.parametrize(
    "value, expected",
    [
        (None, ""),
        ("  abc123 \n", "abc123"),
        ('"abc123"', "abc123"),
        ("'abc123'", "abc123"),
        ("abc123", "abc123"),
    ],
)
def test_clean_strips_whitespace_and_quotes(value, expected):
    # Dashboard'a yapıştırılan değerlerdeki boşluk/tırnak GitHub'da
    # incorrect_client_credentials hatasına yol açıyordu
    assert _clean(value) == expected


def test_oauth_redirect_uri_defaults_to_backend_callback(monkeypatch):
    monkeypatch.delenv("OAUTH_REDIRECT_URI", raising=False)
    monkeypatch.setenv("BACKEND_URL", "https://api.example.com")

    assert _oauth_redirect_uri() == "https://api.example.com/api/auth/callback"


def test_oauth_redirect_uri_prefers_explicit_setting(monkeypatch):
    monkeypatch.setenv("OAUTH_REDIRECT_URI", " https://app.example.com/auth/callback ")
    monkeypatch.setenv("BACKEND_URL", "https://api.example.com")

    assert _oauth_redirect_uri() == "https://app.example.com/auth/callback"
