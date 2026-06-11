import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List


class Order(BaseModel):
    id: int
    status: str


class Orders(BaseModel):
    orders: List[Order]


app = FastAPI()

origins = [
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

memory_db = {1: "pending", 2: "shipped", 3: "delivered"}


@app.get("/orders", response_model=Orders)
def get_orders():
    return Orders(
        orders=[
            Order(id=1, status=memory_db[1]),
            Order(id=2, status=memory_db[2]),
            Order(id=3, status=memory_db[3]),
        ]
    )


@app.post("/orders/{order_id}/status", response_model=Order)
def update_order_status(order_id: int, status: str):
    if order_id in memory_db:
        memory_db[order_id] = status
        return Order(id=order_id, status=memory_db[order_id])
    else:
        return {"message": f"Order {order_id} not found"}, 404


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
