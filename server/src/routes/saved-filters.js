// Saved search filters (Roadmap item 8): named, recallable filter sets for the
// dashboard search. A saved filter stores the { field, op, value } clause list
// the builder produces, scoped to one search surface ('protocol' | 'register').
import { Router } from "express";
import { db } from "../db.js";
import { audit, resolveActor } from "../audit.js";
import { validateFilters, PROTOCOL_FILTER_FIELDS, REGISTER_FILTER_FIELDS } from "./filter.js";

export const router = Router();

export const SEARCH_TYPES = ["protocol", "register"];

const FIELD_DEFS = { protocol: PROTOCOL_FILTER_FIELDS, register: REGISTER_FILTER_FIELDS };

function shape(row) {
  let filters;
  try {
    filters = JSON.parse(row.filters);
  } catch {
    filters = [];
  }
  return { id: row.id, name: row.name, search_type: row.search_type, filters, created_at: row.created_at };
}

// GET /api/saved-filters?search_type=protocol
router.get("/saved-filters", (req, res) => {
  const { search_type } = req.query;
  if (search_type !== undefined && !SEARCH_TYPES.includes(search_type)) {
    return res.status(400).json({ error: `search_type must be one of: ${SEARCH_TYPES.join(", ")}` });
  }
  const rows = search_type
    ? db.prepare("SELECT * FROM saved_filters WHERE search_type = ? ORDER BY created_at DESC, id DESC").all(search_type)
    : db.prepare("SELECT * FROM saved_filters ORDER BY created_at DESC, id DESC").all();
  res.json(rows.map(shape));
});

// POST /api/saved-filters  body: { name, search_type, filters }
router.post("/saved-filters", (req, res) => {
  const { name, search_type, filters } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: "name is required" });
  if (!SEARCH_TYPES.includes(search_type)) {
    return res.status(400).json({ error: `search_type must be one of: ${SEARCH_TYPES.join(", ")}` });
  }
  if (!Array.isArray(filters)) return res.status(400).json({ error: "filters must be an array" });
  const invalid = validateFilters(filters, FIELD_DEFS[search_type]);
  if (invalid) return res.status(400).json({ error: invalid });

  const result = db
    .prepare("INSERT INTO saved_filters (name, search_type, filters) VALUES (?, ?, ?)")
    .run(String(name).trim(), search_type, JSON.stringify(filters));
  const rowId = Number(result.lastInsertRowid);
  audit({
    action: "saved_filter.created",
    entityType: "saved_filter",
    entityId: rowId,
    actor: resolveActor(req),
    details: { name: String(name).trim(), search_type, filter_count: filters.length },
  });
  res.status(201).json(shape(db.prepare("SELECT * FROM saved_filters WHERE id = ?").get(rowId)));
});

// DELETE /api/saved-filters/:id
router.delete("/saved-filters/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM saved_filters WHERE id = ?").get(Number(req.params.id));
  if (!existing) return res.status(404).json({ error: "Saved filter not found" });
  audit({
    action: "saved_filter.deleted",
    entityType: "saved_filter",
    entityId: Number(req.params.id),
    actor: resolveActor(req),
    details: { name: existing.name, search_type: existing.search_type },
  });
  db.prepare("DELETE FROM saved_filters WHERE id = ?").run(Number(req.params.id));
  res.status(204).end();
});
