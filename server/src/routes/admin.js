import { Router } from "express";
import { db } from "../db.js";
import { audit, resolveActor } from "../audit.js";

export const router = Router();

// ---- species ----

router.get("/species", (_req, res) => {
  res.json(db.prepare("SELECT * FROM species ORDER BY name").all());
});

router.post("/species", (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "name is required" });
  try {
    const result = db.prepare("INSERT INTO species (name) VALUES (?)").run(name);
    audit({ action: "species.created", entityType: "species", entityId: Number(result.lastInsertRowid), actor: resolveActor(req), details: { name } });
    res.status(201).json({ id: Number(result.lastInsertRowid), name });
  } catch (err) {
    res.status(409).json({ error: "That species already exists." });
  }
});

router.delete("/species/:id", (req, res) => {
  const existing = db.prepare("SELECT name FROM species WHERE id = ?").get(Number(req.params.id));
  if (!existing) return res.status(404).json({ error: "Species not found" });
  audit({ action: "species.deleted", entityType: "species", entityId: Number(req.params.id), actor: resolveActor(req), details: { name: existing.name } });
  db.prepare("DELETE FROM species WHERE id = ?").run(Number(req.params.id));
  res.status(204).end();
});

// ---- roles ----

router.get("/roles", (_req, res) => {
  res.json(db.prepare("SELECT * FROM roles ORDER BY name").all());
});

router.post("/roles", (req, res) => {
  const name = (req.body.name || "").trim();
  const isCommittee = req.body.is_committee ? 1 : 0;
  if (!name) return res.status(400).json({ error: "name is required" });
  try {
    const result = db.prepare("INSERT INTO roles (name, is_committee) VALUES (?, ?)").run(name, isCommittee);
    audit({ action: "role.created", entityType: "role", entityId: Number(result.lastInsertRowid), actor: resolveActor(req), details: { name, is_committee: isCommittee } });
    res.status(201).json({ id: Number(result.lastInsertRowid), name, is_committee: isCommittee });
  } catch (err) {
    res.status(409).json({ error: "That role already exists." });
  }
});

router.delete("/roles/:id", (req, res) => {
  try {
    const existing = db.prepare("SELECT name FROM roles WHERE id = ?").get(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: "Role not found" });
    audit({ action: "role.deleted", entityType: "role", entityId: Number(req.params.id), actor: resolveActor(req), details: { name: existing.name } });
    const result = db.prepare("DELETE FROM roles WHERE id = ?").run(Number(req.params.id));
    if (result.changes === 0) return res.status(404).json({ error: "Role not found" });
    res.status(204).end();
  } catch (err) {
    res.status(409).json({ error: "This role is still assigned to personnel and can't be deleted." });
  }
});

// ---- personnel (the actual personas: a vet, a committee member, etc) ----

router.get("/personnel", (_req, res) => {
  const rows = db.prepare(`
    SELECT personnel.id, personnel.name, personnel.email, personnel.role_id,
           roles.name AS role_name, roles.is_committee
    FROM personnel
    JOIN roles ON roles.id = personnel.role_id
    ORDER BY personnel.name
  `).all();
  res.json(rows);
});

router.post("/personnel", (req, res) => {
  const { name, email, role_id } = req.body;
  if (!name || !role_id) return res.status(400).json({ error: "name and role_id are required" });

  const role = db.prepare("SELECT * FROM roles WHERE id = ?").get(Number(role_id));
  if (!role) return res.status(400).json({ error: "Unknown role_id" });

  const result = db.prepare("INSERT INTO personnel (name, email, role_id) VALUES (?, ?, ?)")
    .run(name.trim(), email || null, Number(role_id));

  audit({
    action: "personnel.created",
    entityType: "personnel",
    entityId: Number(result.lastInsertRowid),
    actor: resolveActor(req),
    details: { name: name.trim(), role_name: role.name },
  });

  res.status(201).json({
    id: Number(result.lastInsertRowid),
    name: name.trim(),
    email: email || null,
    role_id: Number(role_id),
    role_name: role.name,
    is_committee: role.is_committee,
  });
});

router.delete("/personnel/:id", (req, res) => {
  const existing = db.prepare("SELECT name FROM personnel WHERE id = ?").get(Number(req.params.id));
  if (!existing) return res.status(404).json({ error: "Personnel not found" });
  audit({ action: "personnel.deleted", entityType: "personnel", entityId: Number(req.params.id), actor: resolveActor(req), details: { name: existing.name } });
  db.prepare("DELETE FROM personnel WHERE id = ?").run(Number(req.params.id));
  res.status(204).end();
});
