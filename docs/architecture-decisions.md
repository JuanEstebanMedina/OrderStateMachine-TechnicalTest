# Architecture Decisions

This project keeps the backend as the source of truth for order transitions.
The frontend asks the API for states, transitions, and available events; it does
not derive business rules locally.

## Backend Boundaries

FastAPI routers validate HTTP input and delegate to `OrderService`. The service
loads the order, asks `OrderStateMachine` for the next state, builds the event
record and optional support ticket, then calls one repository operation to
commit the transition.

`OrderRepository` is a port. The in-memory adapter supports local tests and
simple development runs, while the DynamoDB adapter provides external
persistence without leaking table keys or AWS errors into service code.

## Persistence Choice

DynamoDB fits the challenge because the application uses known key-based access
patterns: get one order, query an order's events, list order summaries, and
commit a small atomic transition. PostgreSQL would be a good choice for richer
relational querying and reporting. MongoDB would support flexible documents, but
the state transition workflow benefits from DynamoDB's conditional writes and
transaction API.

The table uses `PK` and `SK` for order aggregates and related event/ticket
items. `GSI1` lists order summaries by creation time. That listing is eventually
consistent; direct base-table order reads use strong consistency.

## Atomic Transitions

Transitions use optimistic locking through `Order.version`. DynamoDB commits the
order update, event item, and optional support ticket in one transaction. The
order update checks both the expected version and the source state, so stale or
racing writers cannot silently overwrite each other.

`ClientRequestToken` protects retries of the same already-constructed DynamoDB
transaction. It does not provide HTTP-level idempotency because separate API
requests create new event IDs.

## Serverless Runtime

AWS SAM deploys API Gateway HTTP API, Lambda, and DynamoDB. Mangum adapts API
Gateway/Lambda events to the ASGI interface used by FastAPI. Lambda Powertools
adds structured logging, tracing, metrics, and cold-start metrics.

## Frontend Concurrency

The order workspace combines `AbortController` with a selection generation
counter. Aborting cancels in-flight requests where possible; generation checks
prevent stale responses that already resolved from replacing the currently
selected order.

## Known Limits And Scale Notes

The demo API has no authentication. The `GSI1PK=ORDERS` listing partition is
acceptable for the challenge, but a high-volume system would bucket or shard the
index. Order detail reads assemble multiple items and are not a transactional
snapshot. Client-provided HTTP idempotency keys would be needed before treating
separate event submissions as idempotent.
