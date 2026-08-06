import { Router } from "express";
import { db } from "../db.js";

export const router = Router();

// ---- species ----

router.get("/species", async (_req, res) => {
  res.json(await db.all("SELECT * FROM species ORDER BY name"));
});

router.post("/species", async (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "name is required" });
  try {
    const row = await db.get("INSERT INTO species (name) VALUES ($1) RETURNING id, name", [name]);
    res.status(201).json({ id: row.id, name });
  } catch (err) {
    res.status(409).json({ error: "That species already exists." });
  }
});

router.delete("/species/:id", async (req, res) => {
  const result = await db.run("DELETE FROM species WHERE id = $1", [Number(req.params.id)]);
  if (result.changes === 0) return res.status(404).json({ error: "Species not found" });
  res.status(204).end();
});

// ---- roles ----

router.get("/roles", async (_req, res) => {
  res.json(await db.all("SELECT * FROM roles ORDER BY name"));
});

router.post("/roles", async (req, res) => {
  const name = (req.body.name || "").trim();
  const isCommittee = req.body.is_committee ? 1 : 0;
  if (!name) return res.status(400).json({ error: "name is required" });
  try {
    const row = await db.get("INSERT INTO roles (name, is_committee) VALUES ($1, $2) RETURNING id", [name, isCommittee]);
    res.status(201).json({ id: row.id, name, is_committee: isCommittee });
  } catch (err) {
    res.status(409).json({ error: "That role already exists." });
  }
});

router.delete("/roles/:id", async (req, res) => {
  try {
    const result = await db.run("DELETE FROM roles WHERE id = $1", [Number(req.params.id)]);
    if (result.changes === 0) return res.status(404).json({ error: "Role not found" });
    res.status(204).end();
  } catch (err) {
    res.status(409).json({ error: "This role is still assigned to personnel and can't be deleted." });
  }
});

// ---- personnel (the actual personas: a vet, a committee member, etc) ----

router.get("/personnel", async (_req, res) => {
  const rows = await db.all(`
    SELECT personnel.id, personnel.name, personnel.email, personnel.role_id,
           roles.name AS role_name, roles.is_committee
    FROM personnel
    JOIN roles ON roles.id = personnel.role_id
    ORDER BY personnel.name
  `);
  res.json(rows);
});

router.post("/personnel", async (req, res) => {
  const { name, email, role_id } = req.body;
  if (!name || !role_id) return res.status(400).json({ error: "name and role_id are required" });

  const role = await db.get("SELECT * FROM roles WHERE id = $1", [Number(role_id)]);
  if (!role) return res.status(400).json({ error: "Unknown role_id" });

  const row = await db.get(
    "INSERT INTO personnel (name, email, role_id) VALUES ($1, $2, $3) RETURNING id",
    [name.trim(), email || null, Number(role_id)]
  );

  res.status(201).json({
    id: row.id,
    name: name.trim(),
    email: email || null,
    role_id: Number(role_id),
    role_name: role.name,
    is_committee: role.is_committee,
  });
});

router.delete("/personnel/:id", async (req, res) => {
  const result = await db.run("DELETE FROM personnel WHERE id = $1", [Number(req.params.id)]);
  if (result.changes === 0) return res.status(404).json({ error: "Personnel not found" });
  res.status(204).end();
});
