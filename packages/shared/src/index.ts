export type Platform = "youtube" | "instagram" | "twitter" | "twitch";
export type MediaKind = "video" | "audio";

export interface MediaFormat {
  id: string;
  kind: MediaKind;
  container: "mp4" | "mp3";
  label: string;
  height?: number;
  bitrate?: number;
  estimatedBytes?: number;
}

export interface MediaInfo {
  id: string;
  platform: Platform;
  title: string;
  author?: string;
  description?: string;
  thumbnail?: string;
  duration?: number;
  formats: MediaFormat[];
}

export type JobStatus = "queued" | "downloading" | "converting" | "finalizing" | "ready" | "failed";
export interface DownloadJob {
  id: string;
  status: JobStatus;
  progress: number;
  filename?: string;
  error?: string;
  downloadUrl?: string;
}
