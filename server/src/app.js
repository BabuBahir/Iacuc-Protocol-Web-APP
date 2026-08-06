import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { openapiSpec } from "./openapi.js";
import { router as protocolsRouter } from "./routes/protocols.js";
import { router as protocolFormRouter } from "./routes/protocol-form.js";
import { router as animalUsageRouter } from "./routes/animal-usage.js";
import { router as adminRouter } from "./routes/admin.js";
import { router as committeeRouter } from "./routes/committee.js";
import { personnelRouter, protocolPersonnelRouter } from "./routes/compliance.js";
import { router as facilitiesRouter } from "./routes/facilities.js";
import { router as pamRouter, pamRouter as pamAuditsRouter } from "./routes/pam.js";
import { router as amendmentsRouter } from "./routes/amendments.js";
import { router as transfersRouter } from "./routes/transfers.js";
import "./db.js"; // ensures schema exists as soon as the app is built 
export function createApp() {
  const app = express(); 
  app.use(express.json());

    // Inside createApp()
  app.use(
    cors({
      origin: "*", // Allows requests from your Vercel frontend URL
      credentials: true,
    })
  );

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.get("/api-docs/spec.json", (_req, res) => res.json(openapiSpec));
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));
  app.use("/api/protocols", protocolsRouter);
  app.use("/api/protocols", protocolFormRouter);
  app.use("/api/protocols", animalUsageRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/committee", committeeRouter);
  app.use("/api/personnel", personnelRouter);
  app.use("/api/protocols", protocolPersonnelRouter);
  app.use("/api", facilitiesRouter);
  app.use("/api", pamRouter);
  app.use("/api/protocols", pamAuditsRouter);
  app.use("/api/protocols", amendmentsRouter);
  app.use("/api", transfersRouter);

  return app;
}
