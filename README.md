# LightNation Check-In

Church check-in app with a React/Vite frontend and an Express backend using Supabase as its only database.

## Directory layout

```text
frontend/
  src/                 React components and API client
  public/              Static assets
  package.json         Frontend dependencies and commands
  vite.config.js       Development API proxy
backend/
  index.js             Express API and production frontend serving
  config.js            Environment loading and database error handling
  server.test.js       Backend regression tests
  supabase-schema.sql  Supabase tables
  .env.example         Environment template
  package.json         Backend dependencies and commands
package.json           Commands to run both applications
```

The former duplicate app and nested Git repository are preserved locally in the ignored .local-backup directory. Dependencies, builds, local databases, and secrets are excluded from Git.

## Setup

Use Node.js 22 or newer. From the repository root:

```sh
npm run install:all
```

Copy backend/.env.example to backend/.env and set SUPABASE_URL and SUPABASE_SECRET_KEY to your project's server credentials. Never put these keys in frontend code. For a new Supabase database, run backend/supabase-schema.sql in the SQL editor. Startup does not insert demo records into Supabase.

In development, backend/.env overrides inherited environment variables. In production (NODE_ENV=production), deployment variables take precedence. Supabase credentials are required. Missing or incomplete configuration stops startup with a clear error; connection failures are reported by the API.

## Running

```sh
npm run dev
```

Frontend: http://localhost:5173. Backend: http://localhost:3000. To run them independently, use npm run dev:frontend and npm run dev:backend in separate terminals, or run npm run dev inside either folder.

The frontend sends requests to /api, and Vite proxies them to port 3000. Update frontend/vite.config.js if you change the backend PORT. For separate production hosts, configure your frontend host to proxy /api to the backend.

## Build and verify

- npm run build: build the frontend into frontend/dist.
- npm start: run the backend and serve the built frontend on port 3000.
- npm test: run backend regression tests with mocked Supabase requests.

GET /api/health verifies database connectivity and returns { "ok": true, "database": "supabase" } when connected. A 503 explains network failures or missing tables. Restart the backend after changing environment settings.

API routes under /api: children CRUD, checkin, checkout, attendance, and ai. Attendance uses ISO timestamps displayed in local time; editing registration details preserves attendance. AI_KEY, AI_PROVIDER, and AI_MODEL configure the optional AI proxy; without a key it returns database summaries.
