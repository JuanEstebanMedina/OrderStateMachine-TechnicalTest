import os


DEFAULT_CORS_ALLOWED_ORIGINS = ["http://localhost:5173"]


def get_cors_allowed_origins() -> list[str]:
    configured_origins = os.getenv("CORS_ALLOWED_ORIGINS")
    if configured_origins is None:
        return DEFAULT_CORS_ALLOWED_ORIGINS.copy()

    origins = [
        origin.strip()
        for origin in configured_origins.split(",")
        if origin.strip()
    ]

    return origins or DEFAULT_CORS_ALLOWED_ORIGINS.copy()
