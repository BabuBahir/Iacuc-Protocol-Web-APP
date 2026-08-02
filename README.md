# IACUC Protocols App

A real two-tier app: an Express + SQLite API, and a Vite + React frontend
with actual client-side routing (`react-router-dom`). This replaces the
single-file prototype with a proper client/server split, managed as an
**npm workspace**.

```
iacuc-app/
  package.json   root — workspaces + convenience scripts
  server/        Express API + SQLite database  (package: iacuc-server)
  client/        Vite + React frontend           (package: iacuc-client)
```

## 1. Install everything (one command, from the repo root)

```bash
npm install
```

npm workspaces installs both `server/` and `client/` dependencies in one
pass and links the workspace together (single `package-lock.json` at the
root). The server uses Node's **built-in `node:sqlite` module** rather than
a native addon package, so this install never needs to compile anything —
no Visual Studio Build Tools, no Python, no prebuilt-binary lookups.
**Requires Node 22.5 or newer** (check with `node --version`).

## 2. Seed and run the server

```bash
copy server\.env.example server\.env    # Windows
# cp server/.env.example server/.env    # macOS/Linux

npm run seed            # creates server/data/iacuc.db with sample protocols
npm run dev:server      # http://localhost:4000
```

Endpoints:

| Method | Path                    | Description                          |
|--------|-------------------------|---------------------------------------|
| GET    | /api/protocols          | List protocols, optional `?q=` search |
| GET    | /api/protocols/summary  | Dashboard metric counts               |
| GET    | /api/protocols/:id      | Single protocol + related items       |
| POST   | /api/protocols          | Create a protocol (starts as Draft)   |
| PATCH  | /api/protocols/:id      | Update fields / advance workflow stage|
| DELETE | /api/protocols/:id      | Delete a protocol                     |

## 3. Run the client

In a second terminal:

```bash
npm run dev:client      # http://localhost:5173
```

Vite proxies any `/api/*` request to `http://localhost:4000` in dev (see
`client/vite.config.js`), so the frontend never needs a hardcoded API URL.

## 4. Open it

Visit `http://localhost:5173`. Clicking a row on the list page navigates to
`/protocols/:id` (a real URL, so refresh/back/forward all work correctly) and
fetches that record from the API.

## Working with individual packages

```bash
npm run seed --workspace=server
npm run build --workspace=client
cd server && npm run dev
```

## Swapping SQLite for Postgres / MySQL later

Every route in `server/src/routes/protocols.js` only talks to the `db`
object exported from `server/src/db.js`. To move to Postgres:

1. `npm install pg --workspace=server`
2. Replace the contents of `db.js` with a `pg.Pool` connection and rewrite
   the handful of prepared statements in `protocols.js` as parameterized
   `pool.query(...)` calls (mostly 1:1 — same SQL, different driver).
3. Point `DB_PATH`/connection string at your Postgres instance via `.env`.

Nothing in the client needs to change, since it only ever talks to the
`/api/protocols` HTTP endpoints.

## Deploying

- **Server**: any Node host (Render, Fly.io, Railway, a VPS). Set
  `CLIENT_ORIGIN` to your deployed frontend's URL for CORS.
- **Client**: `npm run build --workspace=client` produces static files in
  `client/dist/` that can be served from any static host (Vercel, Netlify,
  S3+CloudFront). Point its API calls at your deployed server URL instead of
  the dev proxy (e.g. via a `VITE_API_URL` env var and updating `api.js`).
