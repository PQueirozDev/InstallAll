import { mkdir } from "node:fs/promises";
import { createApp } from "./app.js";
import { config } from "./config.js";
await mkdir(config.TEMP_DIR, { recursive: true });
createApp().listen(config.PORT, () => console.log(`InstallAll API em http://localhost:${config.PORT}`));
