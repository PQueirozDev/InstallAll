import { beforeEach, describe, expect, it, vi } from "vitest";
import { YtDlpProvider } from "../src/providers/ytdlp.js";
import { runProcess } from "../src/process.js";
import { AppError } from "../src/errors.js";
vi.mock("../src/process.js", () => ({ runProcess: vi.fn() }));
const provider = new YtDlpProvider("youtube");
const url = "https://www.youtube.com/watch?v=example";
beforeEach(() => vi.resetAllMocks());
describe("YouTube formats", () => {
  it("offers MP4 and three MP3 bitrates when audio exists", async () => {
    vi.mocked(runProcess).mockResolvedValue(JSON.stringify({ id: "example", title: "Video", formats: [{ height: 720, vcodec: "avc1", acodec: "mp4a" }] }));
    const info = await provider.getInfo(url);
    expect(info.formats.map(f => f.id)).toEqual(["video-720", "video-best", "audio-128", "audio-192", "audio-320"]);
    const mp3 = provider.buildDownloadArgs(url, info.formats[2], "media.%(ext)s");
    expect(mp3).toContain("128K");
    expect(mp3).toContain("bestaudio/best");
    const mp4 = provider.buildDownloadArgs(url, info.formats[0], "media.%(ext)s");
    expect(mp4).toContain("--remux-video");
    expect(mp4.slice(-2)).toEqual(["--", url]);
    expect(mp4).toContain("--ignore-config");
  });
  it("does not offer audio for silent video", async () => {
    vi.mocked(runProcess).mockResolvedValue(JSON.stringify({ id: "example", title: "Video", formats: [{ height: 720, vcodec: "avc1", acodec: "none" }] }));
    expect((await provider.getInfo(url)).formats.every(f => f.kind === "video")).toBe(true);
  });
  it("preserves unavailable errors instead of claiming a server block", async () => {
    const error = new AppError(422, "EXTRACTOR_ERROR", "Unavailable");
    vi.mocked(runProcess).mockRejectedValue(error);
    await expect(provider.getInfo(url)).rejects.toBe(error);
  });
  it("reports an actual access restriction", async () => {
    vi.mocked(runProcess).mockRejectedValue(new AppError(422, "ACCESS_RESTRICTED", "Restricted"));
    await expect(provider.getInfo(url)).rejects.toMatchObject({ code: "YOUTUBE_RESTRICTED" });
  });
});
