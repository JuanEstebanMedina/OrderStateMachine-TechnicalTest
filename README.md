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

Order creation requests are normalized by the API: product IDs are trimmed,
empty IDs are rejected, duplicates are removed while preserving order, and the
amount must be a finite number greater than zero. Invalid create payloads return
HTTP 422.

## Persistence

The API supports two persistence modes:

```text
PERSISTENCE_BACKEND=memory
PERSISTENCE_BACKEND=dynamodb
```

`memory` is the safe default and is used by unit/API tests. `dynamodb` uses one
DynamoDB table through boto3. Domain objects, services, routers, and HTTP
schemas do not contain DynamoDB keys, expressions, table names, or AWS errors.

Order transitions are committed atomically through one explicit repository
operation. The service loads the order, captures the expected version, asks the
state machine for the next state, builds one event log, optionally builds a
support ticket, and calls `commit_transition(...)`. Successful transitions
increment `Order.version` exactly once. Stale same-order changes raise
`OrderVersionConflictError`, which FastAPI maps to HTTP 409 Conflict.

The in-memory adapter uses per-order locks for transition mutation plus a small
registry lock for shared dictionaries. Different order IDs may transition
independently, while two stale updates to the same order allow exactly one
successful commit.

### DynamoDB layout

The DynamoDB adapter uses one table:

```text
Partition key: PK
Sort key: SK
GSI1 partition key: GSI1PK
GSI1 sort key: GSI1SK
```

Order item:

```text
PK = ORDER#<orderId>
SK = ORDER
entityType = ORDER
GSI1PK = ORDERS
GSI1SK = <createdAt>#<orderId>
```

Event item:

```text
PK = ORDER#<orderId>
SK = EVENT#<createdAt>#<eventId>
entityType = ORDER_EVENT
```

Support ticket item:

```text
PK = ORDER#<orderId>
SK = TICKET#<ticketId>
entityType = SUPPORT_TICKET
```

`GET /orders` queries `GSI1`; it does not use `Scan`. The GSI is eventually
consistent, so tests that need immediate summary visibility use bounded polling.
For this technical test, a single `GSI1PK=ORDERS` partition is acceptable. A
high-scale production system would likely shard or bucket that index partition.

Order detail reads use strongly consistent base-table reads: one `GetItem` for
the order item and one `Query` for event items. Event history is reconstructed
from separate event items sorted by their sort keys.

Each transition uses exactly one DynamoDB `TransactWriteItems` request:

- `Update` the order item with conditions on `version` and `currentState`.
- `Put` the event item with key non-existence protection.
- Optionally `Put` the support-ticket item with key non-existence protection.

The transaction uses `ClientRequestToken=str(event_log.id)`. This protects
identical retries of the already-constructed repository operation. It is not
complete HTTP idempotency because a separate API invocation creates a new event
UUID. Stable client idempotency keys or Lambda Powertools are later-phase work.

AWS transaction cancellation reasons are translated to business HTTP 409 only
when the order update condition fails. Transaction conflicts, throttling,
validation errors, credential errors, endpoint errors, and missing-table errors
remain infrastructure failures.

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

Persistence environment variables:

```text
PERSISTENCE_BACKEND=memory
DYNAMODB_TABLE_NAME=OrderStateMachineLocal
DYNAMODB_ENDPOINT_URL=http://localhost:8001
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=local
AWS_SECRET_ACCESS_KEY=local
```

Set `PERSISTENCE_BACKEND=dynamodb` to use DynamoDB. `DYNAMODB_ENDPOINT_URL` is
optional for real AWS. The local credentials above are non-secret values for
DynamoDB Local.

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

The dashboard starts in an overview mode with summary cards, create-order
controls, a full UUID lookup form, and responsive order cards. Selecting an
order opens a workspace view with order identity, event application, history,
and a contextual state-machine diagram. The diagram uses backend transition
metadata for edges; the default view shows only visited and currently available
transitions, while the full transition inventory remains available in a
disclosure.

## Docker Compose local stack

The development stack starts DynamoDB Local, creates the table, runs the FastAPI
backend in DynamoDB mode, and runs the Vite frontend:

```bash
docker compose up --build
```

PowerShell:

```powershell
docker compose up --build
```

Services:

- DynamoDB Local: `http://localhost:8001`
- Backend: `http://localhost:8000`
- Frontend: `http://localhost:5173`

The `dynamodb-init` service is one-shot and runs the idempotent table creation
script. It waits for the table and treats an existing table as success. Table
creation is not performed during FastAPI startup.

## Validation

```bash
cd backend
python -m pytest tests -m "not integration"
```

PowerShell:

```powershell
cd backend
python -m pytest tests -m "not integration"
```

DynamoDB Local integration tests are opt-in:

```bash
cd backend
RUN_DYNAMODB_INTEGRATION=1 python -m pytest tests -m integration
```

PowerShell:

```powershell
cd backend
$env:RUN_DYNAMODB_INTEGRATION = "1"
python -m pytest tests -m integration
Remove-Item Env:RUN_DYNAMODB_INTEGRATION
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

Storage in memory mode is lost when the Python process stops. Repository access is protected for concurrent requests within one process, which supports multiple different order IDs being processed concurrently by FastAPI worker threads.

Each application worker has independent memory. DynamoDB mode persists orders,
events, and support tickets across backend restarts. DynamoDB Local is useful
for development and integration testing, but it is not a production deployment
target and does not model every AWS operational characteristic.

Lambda, SAM, API Gateway, Mangum, Lambda Powertools, S3, CloudFront, and
production container deployment are intentionally outside this phase.

## Vercel frontend deployment

Vercel is the intended frontend deployment target. Set
`VITE_API_BASE_URL` to the API Gateway URL when the backend is deployed, and add
the final Vercel origin to backend `CORS_ALLOWED_ORIGINS`.
