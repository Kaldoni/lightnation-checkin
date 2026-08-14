# LightNation Check-In

LightNation Check-In is a lightweight digital check-in application built for churches and ministries. It provides an easy-to-use interface for registering children, checking them in/out, tracking attendance, and managing quick edits or deletions.

This repository contains a React frontend (Vite) and a Node/Express backend that persists data to a file-based SQLite database.

## Key features

- Quick child registration and editing
- Check-in / Check-out workflow with timestamps
- Attendance summary endpoint
- Simple AI assistant proxy endpoint (configurable via environment variable)
- Local persistence using SQLite (`server/data.db`)

## Tech stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: sqlite3 (file-based)

## Prerequisites

- Node.js 18+ and npm (or pnpm/yarn)
- Git (to clone the repo)

Optional:
- An OpenAI API key (set as `OPENAI_API_KEY` in the server env) to enable the AI assistant endpoint. When not set, the server uses a local fallback response.

## Repository layout

- `client/` — React + Vite frontend
- `server/` — Express backend with `index.js` and `data.db` (created at runtime)
- `package.json` — root scripts to help run server and client

## Installation (local development)

1. Clone the repo:

```bash
git clone https://github.com/Oluwayemisi429/lightnation-checkin.git
cd lightnation-checkin
```

2. Install root dependencies (some scripts rely on root dev tools):

```bash
npm install
```

3. Install client dependencies:

```bash
cd client
npm install
cd ..
```

4. (Optional) If you plan to run the backend in development with automatic restarts, ensure `nodemon` is available via the root `npm install` step or install it globally.

## Running the app

You can run the backend and frontend in separate terminals.

Start the backend (development):

```bash
# from repo root
npm run server:dev
```

Start the frontend (Vite dev server):

```bash
cd client
npm run dev
```

There is also a combined `dev` script in the root that runs both concurrently (if available):

```bash
# from repo root
npm run dev
```

Production-style serve (build client then serve via Express):

```bash
cd client
npm run build
cd ..
# Start production server (serves built client)
npm run server:start
```

After starting the dev servers, the frontend is available at:

- Vite dev: http://localhost:5173/
- Backend API: http://localhost:3000/

## Environment variables

Create a `.env` file in the `server/` folder or set env vars in your shell. Supported variables:

- `PORT` — port for the backend (default 3000)
- `OPENAI_API_KEY` — optional OpenAI key to enable AI assistant proxy

Example `.env` (create `server/.env` or set in your environment):

```env
PORT=3000
OPENAI_API_KEY=
```

## API endpoints

Main server endpoints (base: `http://localhost:3000/api`):

- `GET /api/children` — list all registered children
- `POST /api/children` — create a new child (JSON body)
- `PUT /api/children/:id` — update an existing child (JSON body)
- `DELETE /api/children/:id` — remove a child by id
- `POST /api/checkin` — check-in payload (accepts { id })
- `POST /api/checkout` — check-out payload (accepts { id })
- `GET /api/attendance` — attendance summary
- `POST /api/ai` — AI assistant proxy (server forwards to OpenAI when `OPENAI_API_KEY` set; otherwise returns fallback)

Example create payload (JSON):

```json
{
	"name": "Amara",
	"age": 7,
	"guardian": "Mrs. Johnson",
	"guardianPhone": "080-1234-5678",
	"allergies": "Peanuts",
	"tag": "A001"
}
```

## Database

- The server uses SQLite and creates `server/data.db` automatically on first run.
- You can inspect the DB with any SQLite client.

## Development notes & troubleshooting

- If you get address-in-use errors for port 3000 or 5173, determine which process is listening and stop it (Windows example):

```powershell
netstat -aon | findstr :3000
taskkill /PID <pid> /F
```

- If PUT/POST requests fail from PowerShell's `Invoke-RestMethod`, prefer using Node scripts or a REST client (Postman / Insomnia) to avoid quoting/JSON issues.

- When editing a child in the UI, the app should issue a `PUT /api/children/:id` and then refresh the list from the server. If cards do not update, check the browser console and the server logs for errors, and ensure the backend is running.

## UI / Styling notes

- The project uses Google Fonts. The default font in the UI has been changed to `Cotham Sans`.

## Common commands

- Install (root): `npm install`
- Install (client): `cd client && npm install`
- Start server (dev): `npm run server:dev`
- Start client (dev): `cd client && npm run dev`
- Run both: `npm run dev`
- Build client: `cd client && npm run build`
- Start prod server: `npm run server:start`

## Next steps / TODO

- Test edit/delete flows end-to-end in the browser
- Verify all font replacements and UI polish
- Create a GitHub fork and push a feature branch for review

## Contributing

Contributions, fixes, and improvements are welcome. Please open an issue or a pull request with a clear description of the change.

## License

This project does not include a license file. Add a `LICENSE` if you plan to publish or share this project publicly.

---

If you'd like, I can also:

- add a short demo GIF or screenshots to this README
- add a `.env.example` with recommended variables
- create a small troubleshooting script to check ports and processes on Windows

Tell me which of those you'd like next.
