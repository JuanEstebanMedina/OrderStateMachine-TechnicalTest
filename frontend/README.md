# Order State Machine Dashboard

React/TypeScript operations dashboard for the Order State Machine API.

## Local development

```bash
npm install
npm run dev
```

Configure the API URL with:

```text
VITE_API_BASE_URL=http://localhost:8000
```

The backend should allow the local Vite origin:

```text
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

No Vite proxy is used.

The app is a single-page operations dashboard without routing. The overview
shows summaries, create-order controls, a direct full UUID lookup, and order
cards. Opening an order switches to the workspace for detail, backend-returned
available events, history, and a contextual state-machine diagram. The diagram
shows visited and currently available edges by default, with the complete
backend transition inventory in a disclosure.

Backend metadata drives runtime states, available events, transition
definitions, the initial state, current state, and history. TypeScript models
describe HTTP contracts; they do not define business transitions. The frontend
only keeps labels, formatting, colors, and layout as presentation concerns.

Product IDs can be pasted with commas or line breaks. The field trims values,
removes empties, deduplicates in order, and submits `productIds: string[]`; the
backend remains authoritative for validation. Desktop SVG and mobile journey
views use the same backend-derived journey model.

Runtime `.env` files and build output are intentionally ignored; keep using
`.env.example` as the shared template.

## Validation

```bash
npm run lint
npm run build
npm run test:run
```

## Deployment

Vercel is the intended frontend deployment target. For Vercel, set
`VITE_API_BASE_URL` to the deployed API Gateway URL and add the final Vercel
origin to backend `CORS_ALLOWED_ORIGINS`.

Do not commit `.env` or `dist`.
