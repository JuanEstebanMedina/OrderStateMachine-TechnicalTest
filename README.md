# Order State Machine

Technical challenge project for implementing an order state machine with a Python FastAPI REST API and a React frontend.

## Project structure

- `backend`: Python REST API
- `frontend`: React frontend

## Architecture

The backend uses a simple layered architecture with hexagonal inspiration:

```text
API routes
-> OrderService
-> OrderStateMachine and repository ports
-> in-memory adapters
```

Pydantic schemas are HTTP request and response DTOs. Domain models remain independent from FastAPI and Pydantic. Concrete adapters are selected in `app/dependencies.py`, so business logic depends on repository ports rather than infrastructure implementations.

## Running the backend

```bash
cd backend
python -m venv .venv
```

Activate the environment:

```bash
# Windows PowerShell
.\.venv\Scripts\Activate.ps1

# Unix-like shells
source .venv/bin/activate
```

Install dependencies and run the API:

```bash
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Running tests

```bash
cd backend
python -m pytest tests
```

## API documentation

When the backend is running, OpenAPI documentation is available at:

```text
http://localhost:8000/docs
```

## Endpoints

- `GET /health`
- `POST /orders`
- `GET /orders`
- `GET /orders/{order_id}`
- `POST /orders/{order_id}/events`

Create an order:

```json
{
  "productIds": ["product-1", "product-2"],
  "amount": 1200.5
}
```

Apply an event:

```json
{
  "eventType": "noVerificationNeeded",
  "metadata": {
    "source": "checkout"
  }
}
```

## In-memory storage and concurrency

Storage is currently in memory and is lost when the Python process stops. Repository access is protected for concurrent requests within one process, which supports multiple different order IDs being processed concurrently by FastAPI worker threads.

Each application worker has independent memory. A real database is required for shared persistence across workers or application instances. Atomic persistence of an order update and support ticket creation would require a transaction or Unit of Work in a database-backed implementation.

## Frontend

```bash
cd frontend
npm install
npm run dev
```
