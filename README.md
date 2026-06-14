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

Local frontend CORS is enabled by default for:

```text
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

Use a comma-separated list when more origins are needed:

```text
CORS_ALLOWED_ORIGINS=http://localhost:5173,https://your-app.vercel.app
```

The deployed Vercel origin must be added to `CORS_ALLOWED_ORIGINS` before the
hosted frontend can call the API.

## Running the frontend

```bash
cd frontend
npm install
npm run dev
```

Create a local `.env` file from `frontend/.env.example` when needed:

```text
VITE_API_BASE_URL=http://localhost:8000
```

Do not configure a Vite proxy. The frontend calls the configured API URL
directly, and FastAPI CORS controls allowed browser origins.

## Validation

```bash
cd backend
python -m pytest tests
```

```bash
cd frontend
npm run lint
npm run build
npm run test:run
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
- `GET /orders/{order_id}/available-events`
- `POST /orders/{order_id}/events`
- `GET /state-machine`

`GET /orders` returns summaries without `history`. `POST /orders`,
`GET /orders/{order_id}`, and `POST /orders/{order_id}/events` return detailed
orders with complete `history`.

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

## Vercel frontend deployment

Vercel is the intended frontend deployment target. Set
`VITE_API_BASE_URL` to the API Gateway URL when the backend is deployed, and add
the final Vercel origin to backend `CORS_ALLOWED_ORIGINS`.
