import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import pg from "pg";
import { applySqliteSchema } from "./schema.sqlite.js";
import { postgresSchema } from "./schema.postgres.js";

// Dual-driver data layer.
//
//   * `DATABASE_URL` set  -> Postgres (production: Supabase hosted Postgres).
//     A `pg` Pool is created and the Postgres schema is applied idempotently
//     on first use (or explicitly via initDb()).
//   * otherwise            -> SQLite via Node's built-in node:sqlite
//     (dev/tests/e2e). DB_PATH selects the file; ":memory:" for unit tests.
//
// Routes/tests never touch a driver directly — they call the async facade
// (db.all / db.get / db.run / db.transaction). SQL is written in Postgres
// syntax so one string works on both backends:
//   - placeholders are $1..$n positional (the SQLite backend rewrites them
//     to "?" in order — node:sqlite treats "$1" as a named param otherwise)
//   - timestamps use CURRENT_TIMESTAMP (NOT datetime('now'))
//   - inserts read the new row via INSERT ... RETURNING (never
//     lastInsertRowid); both SQLite >= 3.35 and Postgres support RETURNING
//   - INSERT OR IGNORE is written INSERT ... ON CONFLICT DO NOTHING
//   - aggregates (COUNT/SUM) are coerced to JS numbers by a pg int8 parser
//     (SQLite already returns numbers)

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const usePostgres = Boolean(process.env.DATABASE_URL);

// Rewrite Postgres-style $n placeholders to SQLite "?" in order.
function toSqlitePlaceholders(sql) {
  return sql.replace(/\$(\d+)/g, () => "?");
}

let sqlite = null;
let pool = null;
let initPromise = null;

export function init() {
  if (!initPromise) initPromise = doInit();
  return initPromise;
}

async function doInit() {
  if (usePostgres) {
    // COUNT(*) / SUM(integer) come back as int8 (string) in Postgres; coerce
    // to numbers so `=== 0` checks and arithmetic keep working. Ids are
    // int4 (IDENTITY), which node-postgres already returns as numbers.
    pg.types.setTypeParser(20, (v) => parseInt(v, 10));
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      // Supabase's pooler (PgBouncer) can silently drop/half-open idle
      // sessions; without these, pool.query() would block forever on a
      // wedged socket instead of failing and replacing the client.
      connectionTimeoutMillis: 10000,
      query_timeout: 30000,
      idleTimeoutMillis: 30000,
      keepAlive: true,
      max: 10,
    });
    pool.on("error", (err) => console.error("Postgres pool error:", err.message));
    for (const stmt of postgresSchema) await pool.query(stmt);
  } else {
    const dbPath =
      process.env.DB_PATH === ":memory:"
        ? ":memory:"
        : process.env.DB_PATH
        ? path.resolve(process.cwd(), process.env.DB_PATH)
        : path.join(dataDir, "iacuc.db");
    sqlite = new DatabaseSync(dbPath);
    applySqliteSchema(sqlite);
  }
}

// ---- SQLite backend (synchronous under the hood, awaited by the facade) ----

function sqliteAll(conn, sql, params) {
  return conn.prepare(toSqlitePlaceholders(sql)).all(...params);
}

function sqliteGet(conn, sql, params) {
  return conn.prepare(toSqlitePlaceholders(sql)).get(...params);
}

function sqliteRun(conn, sql, params) {
  return conn.prepare(toSqlitePlaceholders(sql)).run(...params);
}

// ---- Postgres backend ----

async function pgAll(client, sql, params) {
  const r = await client.query({ text: sql, values: params });
  return r.rows;
}

async function pgGet(client, sql, params) {
  const r = await client.query({ text: sql, values: params });
  return r.rows[0];
}

async function pgRun(client, sql, params) {
  const r = await client.query({ text: sql, values: params });
  return { changes: r.rowCount ?? 0 };
}

function txScope(clientOrConn, isPg) {
  return {
    all: (sql, params = []) => (isPg ? pgAll(clientOrConn, sql, params) : sqliteAll(clientOrConn, sql, params)),
    get: (sql, params = []) => (isPg ? pgGet(clientOrConn, sql, params) : sqliteGet(clientOrConn, sql, params)),
    run: (sql, params = []) => (isPg ? pgRun(clientOrConn, sql, params) : sqliteRun(clientOrConn, sql, params)),
  };
}

// ---- public facade ----

export async function all(sql, params = []) {
  await init();
  return usePostgres ? pgAll(pool, sql, params) : sqliteAll(sqlite, sql, params);
}

export async function get(sql, params = []) {
  await init();
  return usePostgres ? pgGet(pool, sql, params) : sqliteGet(sqlite, sql, params);
}

export async function run(sql, params = []) {
  await init();
  return usePostgres ? pgRun(pool, sql, params) : sqliteRun(sqlite, sql, params);
}

// Runs `fn(scope)` inside a transaction. `scope` exposes the same
// all/get/run helpers bound to a dedicated connection, so the whole block
// commits or rolls back together (matches the old db.exec("BEGIN")/COMMIT
// pattern used by the procedures upsert and the seeder).
export async function transaction(fn) {
  await init();
  if (usePostgres) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(txScope(client, true));
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
  sqlite.exec("BEGIN");
  try {
    const result = await fn(txScope(sqlite, false));
    sqlite.exec("COMMIT");
    return result;
  } catch (err) {
    sqlite.exec("ROLLBACK");
    throw err;
  }
}

export async function closeDb() {
  await init();
  if (usePostgres) await pool.end();
  else sqlite.close();
}

export const initDb = init;
export const db = { all, get, run, transaction, init, closeDb, dialect: usePostgres ? "postgres" : "sqlite" };
