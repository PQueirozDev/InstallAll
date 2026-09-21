import type { MediaFormat, MediaInfo, Platform } from "@installall/shared";
import { config } from "../config.js";
import { AppError } from "../errors.js";
import { runProcess } from "../process.js";
import type { Provider } from "./types.js";

interface RawFormat { format_id?: string; ext?: string; height?: number; filesize?: number; filesize_approx?: number; vcodec?: string; acodec?: string; tbr?: number; }
interface RawInfo { id?: string; title?: string; uploader?: string; channel?: string; creator?: string; description?: string; thumbnail?: string; duration?: number; formats?: RawFormat[]; }

export class YtDlpProvider implements Provider {
  constructor(public readonly platform: Platform) {}
  private extractorArgs(): string[] {
    // The embedded client is intentionally limited to publicly embeddable videos
    // and does not require account cookies or authentication bypasses.
    return this.platform === "youtube"
      ? ["--extractor-args", "youtube:player_client=web_embedded;player_skip=webpage"]
      : [];
  }
  async getInfo(url: string): Promise<MediaInfo> {
    let out: string;
    try {
      out = await runProcess(config.YTDLP_PATH, ["--dump-single-json", "--no-playlist", "--no-warnings", "--socket-timeout", "15", ...this.extractorArgs(), url], { timeoutMs: 90_000 });
    } catch (error) {
      if (this.platform === "youtube" && error instanceof AppError && error.code === "EXTRACTOR_ERROR") {
        throw new AppError(422, "YOUTUBE_RESTRICTED", "O YouTube bloqueou o acesso deste servidor. Apenas vídeos públicos e incorporáveis podem funcionar, sem contornar a proteção da plataforma.");
      }
      throw error;
    }
    const raw = JSON.parse(out) as RawInfo;
    if (!raw.id || !raw.title) throw new AppError(422, "NO_METADATA", "Não foi possível obter os dados desse vídeo.");
    if ((raw.duration ?? 0) > config.MAX_MEDIA_DURATION_SECONDS) throw new AppError(413, "TOO_LONG", "Este vídeo excede o limite de duração configurado.");
    const formats = this.toFormats(raw.formats ?? []);
    if (!formats.length) throw new AppError(422, "NO_FORMATS", "Formato solicitado indisponível.");
    return { id: raw.id, platform: this.platform, title: raw.title, author: raw.uploader ?? raw.channel ?? raw.creator, description: raw.description?.slice(0, 280), thumbnail: raw.thumbnail, duration: raw.duration, formats };
  }
  private toFormats(raw: RawFormat[]): MediaFormat[] {
    const videos = new Map<number, MediaFormat>();
    for (const f of raw) {
      if (!f.height || f.vcodec === "none") continue;
      const height = f.height;
      if (this.platform === "youtube" && ![360, 480, 720, 1080].includes(height)) continue;
      const bytes = f.filesize ?? f.filesize_approx;
      const current = videos.get(height);
      if (!current || (bytes ?? 0) > (current.estimatedBytes ?? 0)) videos.set(height, { id: `video-${height}`, kind: "video", container: "mp4", label: `${height}p`, height, estimatedBytes: bytes });
    }
    const list = [...videos.values()].sort((a, b) => (a.height ?? 0) - (b.height ?? 0));
    if (list.length) list.push({ id: "video-best", kind: "video", container: "mp4", label: "Melhor qualidade" });
    if (this.platform === "youtube") for (const bitrate of [128, 192, 320]) list.push({ id: `audio-${bitrate}`, kind: "audio", container: "mp3", label: `MP3 ${bitrate} kbps`, bitrate });
    return list;
  }
  buildDownloadArgs(url: string, format: MediaFormat, output: string): string[] {
    const common = ["--no-playlist", "--no-warnings", "--newline", ...this.extractorArgs(), "--progress-template", "download:PROGRESS:%(progress._percent_str)s", "--max-filesize", String(config.MAX_OUTPUT_BYTES), "-o", output];
    if (format.kind === "audio") return [...common, "-f", "bestaudio", "-x", "--audio-format", "mp3", "--audio-quality", `${format.bitrate ?? 192}K`, url];
    const selector = format.height ? `bestvideo[height<=${format.height}]+bestaudio/best[height<=${format.height}]` : "bestvideo+bestaudio/best";
    return [...common, "-f", selector, "--merge-output-format", "mp4", url];
  }
}
