from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.domain import InvalidOrderTransitionError, OrderNotFoundError


def order_not_found_handler(
    _request: Request,
    exc: OrderNotFoundError,
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"detail": str(exc)},
    )


def invalid_order_transition_handler(
    _request: Request,
    exc: InvalidOrderTransitionError,
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"detail": str(exc)},
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.exception_handler(OrderNotFoundError)(order_not_found_handler)
    app.exception_handler(InvalidOrderTransitionError)(invalid_order_transition_handler)
