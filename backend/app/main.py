from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.exception_handlers import register_exception_handlers
from app.api.routers.health import router as health_router
from app.api.routers.orders import router as orders_router
from app.api.routers.state_machine import router as state_machine_router
from app.config import get_cors_allowed_origins, normalize_api_gateway_base_path


def create_app(root_path: str = "") -> FastAPI:
    application = FastAPI(
        title="Order State Machine API",
        root_path=normalize_api_gateway_base_path(root_path),
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=get_cors_allowed_origins(),
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    application.include_router(health_router)
    application.include_router(orders_router)
    application.include_router(state_machine_router)
    register_exception_handlers(application)
    return application


app = create_app()
