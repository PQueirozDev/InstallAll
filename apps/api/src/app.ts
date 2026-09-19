import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { config } from "./config.js";
import { AppError, publicMessage } from "./errors.js";
import { createJob, deleteJob, getJob, getJobFile } from "./jobs.js";
import { getProvider } from "./providers/index.js";
import { validatePublicUrl } from "./security/url.js";

const urlSchema = z.object({ url: z.string().min(8).max(2048) }).strict();
const downloadSchema = z.object({ url: z.string().min(8).max(2048), formatId: z.string().min(1).max(50) }).strict();
const asyncRoute = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => void fn(req, res).catch(next);
const owner = (req: Request) => req.ip ?? req.socket.remoteAddress ?? "unknown";
const routeId = (value: string | string[] | undefined) => {
  if (typeof value !== "string") throw new AppError(400, "INVALID_ID", "Identificador inválido.");
  return value;
};

export function createApp() {
  const app = express();
  app.set("trust proxy", config.TRUST_PROXY ? 1 : false);
  app.disable("x-powered-by");
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: config.WEB_ORIGIN, methods: ["GET", "POST"], allowedHeaders: ["Content-Type"] }));
  app.use(express.json({ limit: "8kb", strict: true }));
  app.get("/health", (_req, res) => res.json({ status: "ok", service: "installall-api" }));

  const analyzeLimit = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Muitas análises. Aguarde um minuto." } });
  app.post("/api/analyze", analyzeLimit, asyncRoute(async (req, res) => {
    const { url } = urlSchema.parse(req.body);
    const validated = await validatePublicUrl(url);
    const info = await getProvider(validated.platform).getInfo(validated.url);
    res.json(info);
  }));
  app.post("/api/downloads", rateLimit({ windowMs: 60_000, limit: 12, standardHeaders: "draft-8", legacyHeaders: false }), asyncRoute(async (req, res) => {
    const input = downloadSchema.parse(req.body);
    const validated = await validatePublicUrl(input.url);
    const provider = getProvider(validated.platform);
    const info = await provider.getInfo(validated.url);
    const format = info.formats.find((item) => item.id === input.formatId);
    if (!format) throw new AppError(400, "FORMAT_UNAVAILABLE", "Formato solicitado indisponível.");
    res.status(202).json(await createJob(owner(req), validated.url, provider, format, info.title));
  }));
  app.get("/api/jobs/:id", (req, res) => res.json(getJob(routeId(req.params.id))));
  app.get("/api/jobs/:id/file", asyncRoute(async (req, res) => {
    const id = routeId(req.params.id);
    const file = await getJobFile(id);
    res.setHeader("Content-Type", file.filename.endsWith(".mp3") ? "audio/mpeg" : "video/mp4");
    res.setHeader("Content-Length", file.size);
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
    res.setHeader("Cache-Control", "private, no-store");
    res.sendFile(file.path, (error) => { void deleteJob(id); if (error && !res.headersSent) res.status(500).end(); });
  }));
  app.use((_req, res) => res.status(404).json({ error: "Rota não encontrada." }));
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    void _next;
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Dados enviados são inválidos." });
    const status = error instanceof AppError ? error.status : 500;
    if (status >= 500) console.error(error);
    return res.status(status).json({ error: publicMessage(error) });
  });
  return app;
}
