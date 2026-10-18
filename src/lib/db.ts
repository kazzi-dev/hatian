import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * Local storage uses Node's built-in SQLite, so the app runs with zero setup.
 * The schema sticks to plain SQL (TEXT ids, INTEGER centavos) so it ports to
 * Postgres/Supabase by swapping this file and the queries in repo.ts.
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS groups (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS members (
  id          TEXT PRIMARY KEY,
  group_id    TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS members_group ON members(group_id);

CREATE TABLE IF NOT EXISTS expenses (
  id               TEXT PRIMARY KEY,
  group_id         TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  description      TEXT NOT NULL,
  category         TEXT NOT NULL,
  amount_centavos  INTEGER NOT NULL CHECK (amount_centavos > 0),
  paid_by          TEXT NOT NULL REFERENCES members(id),
  split_type       TEXT NOT NULL CHECK (split_type IN ('equal','exact','percent','shares')),
  spent_on         TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  deleted_at       TEXT
);
CREATE INDEX IF NOT EXISTS expenses_group ON expenses(group_id);

-- One row per member in the split. input_value is what the user typed (meaning depends
-- on split_type); amount_centavos is the computed share, stored so history never shifts.
CREATE TABLE IF NOT EXISTS expense_shares (
  expense_id       TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  member_id        TEXT NOT NULL REFERENCES members(id),
  input_value      INTEGER NOT NULL,
  amount_centavos  INTEGER NOT NULL,
  PRIMARY KEY (expense_id, member_id)
);

CREATE TABLE IF NOT EXISTS settlements (
  id               TEXT PRIMARY KEY,
  group_id         TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  from_member      TEXT NOT NULL REFERENCES members(id),
  to_member        TEXT NOT NULL REFERENCES members(id),
  amount_centavos  INTEGER NOT NULL CHECK (amount_centavos > 0),
  created_at       TEXT NOT NULL,
  deleted_at       TEXT
);
CREATE INDEX IF NOT EXISTS settlements_group ON settlements(group_id);

-- Append-only audit trail: every change to a group is recorded here.
CREATE TABLE IF NOT EXISTS activity (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id    TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  message     TEXT NOT NULL,
  details     TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS activity_group ON activity(group_id, id);
`;

function open(): DatabaseSync {
  const file = process.env.HATIAN_DB ?? path.join(process.cwd(), "data", "hatian.db");
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  return db;
}

// Reuse one connection across hot reloads in dev.
const globalForDb = globalThis as unknown as { hatianDb?: DatabaseSync };
export const db = globalForDb.hatianDb ?? (globalForDb.hatianDb = open());

export function transaction<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
