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

Create-order input trims product IDs, removes duplicates, and requires a
positive finite amount before submitting to the API. Runtime `.env` files and
build output are intentionally ignored; keep using `.env.example` as the shared
template.

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
