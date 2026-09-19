import type { DownloadJob, MediaInfo } from "@installall/shared";
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Não foi possível concluir a solicitação.");
  return data as T;
}
export const analyze = (url: string) => request<MediaInfo>("/api/analyze", { method: "POST", body: JSON.stringify({ url }) });
export const startDownload = (url: string, formatId: string) => request<DownloadJob>("/api/downloads", { method: "POST", body: JSON.stringify({ url, formatId }) });
export const getJob = (id: string) => request<DownloadJob>(`/api/jobs/${id}`);
