import { randomUUID } from "node:crypto";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import type { DownloadJob, MediaFormat } from "@installall/shared";
import { config } from "./config.js";
import { AppError } from "./errors.js";
import { runProcess } from "./process.js";
import type { Provider } from "./providers/types.js";

interface InternalJob extends DownloadJob { filePath?: string; createdAt: number; owner: string; }
const jobs = new Map<string, InternalJob>();
const activeByIp = new Map<string, number>();
export const sanitizeFilename = (name: string) => {
  const cleaned = name.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._ -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/^[._ -]+|[._ -]+$/g, "")
    .slice(0, 100);
  return cleaned || "video";
};

export async function createJob(owner: string, url: string, provider: Provider, format: MediaFormat, title: string): Promise<DownloadJob> {
  if ((activeByIp.get(owner) ?? 0) >= 3) throw new AppError(429, "TOO_MANY_DOWNLOADS", "Você já possui 3 downloads em processamento.");
  const id = randomUUID();
  const dir = path.join(config.TEMP_DIR, id);
  await mkdir(dir, { recursive: true });
  const ext = format.container;
  const output = path.join(dir, `media.%(ext)s`);
  const job: InternalJob = { id, status: "queued", progress: 0, createdAt: Date.now(), owner };
  jobs.set(id, job); activeByIp.set(owner, (activeByIp.get(owner) ?? 0) + 1);
  void (async () => {
    try {
      job.status = "downloading";
      await runProcess(config.YTDLP_PATH, provider.buildDownloadArgs(url, format, output), { timeoutMs: 30 * 60_000, onLine: (line) => {
        const match = line.match(/PROGRESS:\s*([\d.]+)%/); if (match) job.progress = Math.min(94, Number(match[1]));
        if (/post-process|merg|convert|extractaudio/i.test(line)) job.status = "converting";
      }});
      job.status = "finalizing"; job.progress = 97;
      const files = await readdir(dir);
      const actual = files.find((file) => file.endsWith(`.${ext}`)) ?? files.find((file) => !file.endsWith(".part") && !file.endsWith(".ytdl"));
      if (!actual) throw new AppError(500, "NO_OUTPUT", "Não foi possível concluir o processamento.");
      job.filePath = path.join(dir, actual); job.filename = `${sanitizeFilename(title)}.${ext}`; job.status = "ready"; job.progress = 100; job.downloadUrl = `/api/jobs/${id}/file`;
    } catch (error) { job.status = "failed"; job.error = error instanceof AppError ? error.message : "Não foi possível concluir o processamento."; }
    finally { activeByIp.set(owner, Math.max(0, (activeByIp.get(owner) ?? 1) - 1)); }
  })();
  return expose(job);
}
const expose = (job: InternalJob): DownloadJob => ({ id: job.id, status: job.status, progress: job.progress, filename: job.filename, error: job.error, downloadUrl: job.downloadUrl });
// UUIDs act as unguessable bearer identifiers. IP binding is deliberately avoided
// because clients can legitimately switch between IPv4/IPv6 behind CDNs.
export function getJob(id: string): DownloadJob { const job = jobs.get(id); if (!job) throw new AppError(404, "JOB_NOT_FOUND", "Download não encontrado."); return expose(job); }
export async function getJobFile(id: string) { const job = jobs.get(id); if (!job || job.status !== "ready" || !job.filePath) throw new AppError(404, "FILE_NOT_FOUND", "Arquivo não disponível."); return { path: job.filePath, filename: job.filename!, size: (await stat(job.filePath)).size }; }
export async function deleteJob(id: string) { const job = jobs.get(id); if (!job) return; jobs.delete(id); if (job.filePath) await rm(path.dirname(job.filePath), { recursive: true, force: true }); }
setInterval(() => { for (const [id, job] of jobs) if (Date.now() - job.createdAt > config.JOB_TTL_MS) void deleteJob(id); }, 60_000).unref();
