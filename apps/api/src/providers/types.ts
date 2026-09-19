import type { MediaFormat, MediaInfo, Platform } from "@installall/shared";
export interface Provider {
  readonly platform: Platform;
  getInfo(url: string): Promise<MediaInfo>;
  buildDownloadArgs(url: string, format: MediaFormat, outputTemplate: string): string[];
}
