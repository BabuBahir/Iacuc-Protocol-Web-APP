import "dotenv/config";
import { createApp } from "./app.js";

const app = createApp();
const PORT = process.env.API_BASE_URL || 4000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`IACUC API listening on port ${PORT}`);
});