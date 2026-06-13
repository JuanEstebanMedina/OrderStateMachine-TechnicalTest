from fastapi import FastAPI

from app.api.exception_handlers import register_exception_handlers
from app.api.routes.health import router as health_router
from app.api.routes.orders import router as orders_router


app = FastAPI(title="Order State Machine API")

app.include_router(health_router)
app.include_router(orders_router)
register_exception_handlers(app)
