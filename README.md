# LightNation Check-In

Church check-in app with a React/Vite frontend and an Express backend that can run against either Supabase or Firebase. The repo includes a migration script that exports rows from Supabase and imports them into Firebase collections.

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

For a separate Vercel backend project, set its Root Directory to `backend` and use Express framework detection. Set `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in the project's Production environment and redeploy after changes. The ignored local `.env` is not deployed. The backend exports its Express request handler directly; on Vercel, `/` returns service information and `/api/health` checks Supabase. It does not serve the frontend build on Vercel. A separate frontend project should use Root Directory `frontend`, with `/api` proxied to the backend as described above.

- npm run build: build the frontend into frontend/dist.
- npm start: run the backend and serve the built frontend on port 3000.
- npm test: run backend regression tests with mocked Supabase requests.

GET /api/health verifies database connectivity and returns { "ok": true, "database": "supabase" } when connected. A 503 explains network failures or missing tables. Restart the backend after changing environment settings.

API routes under /api: children CRUD, checkin, checkout, attendance, and ai. Attendance uses ISO timestamps displayed in local time; editing registration details preserves attendance. AI_KEY, AI_PROVIDER, and AI_MODEL configure the optional AI proxy; without a key it returns database summaries.

## Attendance reports

Run `backend/reporting-migration.sql` in the Supabase SQL editor after the base schema, for both existing and new installations. This installs transactional attendance-history recording and a reporting start date. It is safe to rerun and preserves the original start date. Deploy the updated backend and frontend together; install backend dependencies for Word export.

Teachers can open **Reports**, choose weekly or monthly and a date/month, then select **View report** or **Download .docx**. Both formats include Sunday attendance and absence counts and per-child totals. Monthly reports list children absent for at least three completed Sundays, with names, tags, and missed dates. Downloads require the same teacher authentication as the rest of the app.

Weeks run Monday–Sunday in Africa/Lagos time. Monthly totals count child-Sundays, with unique attendees shown separately. Repeated check-ins on one Sunday count once; checkout does not remove attendance. Sundays before registration, future Sundays, and days before reliable recording began are excluded. The installation day is excluded because its history may be incomplete. Today's Sunday counts are provisional and do not contribute to the recurring-absence threshold until the day ends. No earlier history is inferred from latest-check-in fields. Reports use the current roster; deleting a child also removes their historical records. All eligible Sundays are assumed to be service days.

API: `GET /api/reports?type=weekly|monthly&date=YYYY-MM-DD`, with optional `&format=docx`. Reports are generated from live records on request, not saved snapshots.

## Teacher access

Teachers sign in with Supabase Auth. Accounts must have app_metadata.role set to teacher by an administrator; there is no public registration screen. Every children, attendance, check-in, checkout, and assistant API request requires a verified teacher token. Health checks remain public.

To create another teacher, prepare a private JSON file containing email and password (at least 12 characters), then run node backend/create-teacher.js <private-file-path>. Keep the file outside Git and remove it afterwards. The script creates a confirmed account without sending email and never overwrites an existing account.

Sessions are kept in memory. Refreshing the page or signing out requires signing in again; expired sessions return to the login screen. Each child's card includes Delete entry with confirmation. Deleting a child also deletes linked attendance records through the database's foreign-key cascade.
