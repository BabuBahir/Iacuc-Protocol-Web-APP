import "dotenv/config";
import { createApp } from "./app.js";
import { db } from "./db.js";

const app = createApp();
const PORT = process.env.PORT || 4000;

const { n } = db.prepare("SELECT COUNT(*) AS n FROM protocols").get();
if (n === 0) {
  await import("./seed.js");
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`IACUC API listening on port ${PORT}`);
});
