import "dotenv/config";
import { createApp } from "./app.js";
import { db } from "./db.js";

const app = createApp();
const PORT = process.env.PORT || 4000;

const { n } = db.prepare("SELECT COUNT(*) AS n FROM protocols").get();
const forceSeed = process.env.SEED_ON_STARTUP === 'true';

console.log(`Database initialized. Protocol count: ${n}. SEED_ON_STARTUP: ${process.env.SEED_ON_STARTUP}`);

if (n === 0 || forceSeed) {
  if (forceSeed) {
    console.log("Forcing database re-seed due to SEED_ON_STARTUP=true");
  } else {
    console.log("Database is empty, triggering automatic seed.");
  }
  await import("./seed.js");
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`IACUC API listening on port ${PORT}`);
});
