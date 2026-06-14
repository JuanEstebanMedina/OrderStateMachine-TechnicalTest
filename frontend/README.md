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
