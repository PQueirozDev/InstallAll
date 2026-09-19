import "dotenv/config";
import path from "node:path";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  YTDLP_PATH: z.string().default("yt-dlp"),
  FFMPEG_PATH: z.string().default("ffmpeg"),
  TEMP_DIR: z.string().default("./tmp"),
  MAX_MEDIA_DURATION_SECONDS: z.coerce.number().positive().default(7200),
  MAX_OUTPUT_BYTES: z.coerce.number().positive().default(2_147_483_648),
  JOB_TTL_MS: z.coerce.number().positive().default(3_600_000),
  TRUST_PROXY: z.enum(["true", "false"]).default("false")
});
const parsed = schema.parse(process.env);
export const config = { ...parsed, TEMP_DIR: path.resolve(parsed.TEMP_DIR), TRUST_PROXY: parsed.TRUST_PROXY === "true" };
