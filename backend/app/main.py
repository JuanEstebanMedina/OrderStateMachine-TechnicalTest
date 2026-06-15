from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.exception_handlers import register_exception_handlers
from app.api.routers.health import router as health_router
from app.api.routers.orders import router as orders_router
from app.api.routers.state_machine import router as state_machine_router
from app.config import get_cors_allowed_origins


app = FastAPI(title="Order State Machine API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_allowed_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

app.include_router(health_router)
app.include_router(orders_router)
app.include_router(state_machine_router)
register_exception_handlers(app)
