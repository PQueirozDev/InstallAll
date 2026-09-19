import { describe, expect, it } from "vitest";
import { detectPlatform } from "../src/security/url.js";
import { sanitizeFilename } from "../src/jobs.js";

describe("detectPlatform", () => {
  it.each([
    ["https://youtube.com/watch?v=abc", "youtube"], ["https://youtu.be/abc", "youtube"],
    ["https://instagram.com/reel/abc", "instagram"], ["https://x.com/user/status/1", "twitter"],
    ["https://clips.twitch.tv/Clip", "twitch"]
  ])("detecta %s", (url, platform) => expect(detectPlatform(url)).toBe(platform));
  it.each(["file:///etc/passwd", "http://localhost/a", "https://youtube.com.evil.test/a", "not-url"])("rejeita %s", (url) => expect(() => detectPlatform(url)).toThrow());
});
describe("sanitizeFilename", () => {
  it("remove traversal e caracteres especiais", () => expect(sanitizeFilename("../../Olá: vídeo? *2026*")).toBe("....Ola-video-2026"));
});
