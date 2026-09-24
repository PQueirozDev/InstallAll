import { spawn } from "node:child_process";
import { AppError } from "./errors.js";

export interface RunOptions { timeoutMs?: number; onLine?: (line: string) => void; signal?: AbortSignal; }

export function runProcess(command: string, args: readonly string[], options: RunOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const maxCapture = 20 * 1024 * 1024;
    const timer = setTimeout(() => child.kill(), options.timeoutMs ?? 120_000);
    const consume = (target: "out" | "err", chunk: Buffer) => {
      const value = chunk.toString();
      if (target === "out") stdout = (stdout + value).slice(-maxCapture); else stderr = (stderr + value).slice(-64_000);
      value.split(/\r?\n/).filter(Boolean).forEach((line) => options.onLine?.(line));
    };
    child.stdout.on("data", (c: Buffer) => consume("out", c));
    child.stderr.on("data", (c: Buffer) => consume("err", c));
    options.signal?.addEventListener("abort", () => child.kill(), { once: true });
    child.on("error", (error) => { clearTimeout(timer); reject(new AppError(503, "PROCESS_UNAVAILABLE", `Dependência de mídia indisponível: ${error.message}`)); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new AppError(422, /confirm you.re not a bot|sign in to confirm|http error 429/i.test(stderr) ? "ACCESS_RESTRICTED" : "EXTRACTOR_ERROR", classify(stderr)));
    });
  });
}

function classify(stderr: string): string {
  const text = stderr.toLowerCase();
  if (text.includes("private") || text.includes("login") || text.includes("authentication")) return "Este conteúdo não está disponível publicamente.";
  if (text.includes("unsupported url")) return "Essa URL não é compatível.";
  if (text.includes("not available") || text.includes("unavailable")) return "Não foi possível acessar esse vídeo.";
  return "Não foi possível acessar esse conteúdo público.";
}
