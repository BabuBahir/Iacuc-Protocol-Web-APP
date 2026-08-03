import express from "express";
import cors from "cors";
import { router as protocolsRouter } from "./routes/protocols.js";
import { router as protocolFormRouter } from "./routes/protocol-form.js";
import { router as animalUsageRouter } from "./routes/animal-usage.js";
import { router as adminRouter } from "./routes/admin.js";
import { router as committeeRouter } from "./routes/committee.js";
import "./db.js"; // ensures schema exists as soon as the app is built

export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
  app.use(express.json());

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/protocols", protocolsRouter);
  app.use("/api/protocols", protocolFormRouter);
  app.use("/api/protocols", animalUsageRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/committee", committeeRouter);

  return app;
}
