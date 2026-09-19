import dns from "node:dns/promises";
import net from "node:net";
import type { Platform } from "@installall/shared";
import { AppError } from "../errors.js";

const hosts: Record<Platform, RegExp[]> = {
  youtube: [/^(?:www\.|m\.)?youtube\.com$/i, /^youtu\.be$/i],
  instagram: [/^(?:www\.)?instagram\.com$/i],
  twitter: [/^(?:www\.)?(?:twitter\.com|x\.com)$/i],
  twitch: [/^(?:www\.)?(?:clips\.twitch\.tv|twitch\.tv)$/i]
};

export function detectPlatform(input: string): Platform {
  let url: URL;
  try { url = new URL(input); } catch { throw new AppError(400, "INVALID_URL", "Link inválido."); }
  if (url.protocol !== "https:") throw new AppError(400, "INVALID_URL", "Use um link HTTPS público.");
  if (url.username || url.password || url.port) throw new AppError(400, "INVALID_URL", "Link inválido.");
  for (const [platform, patterns] of Object.entries(hosts) as [Platform, RegExp[]][]) {
    if (patterns.some((pattern) => pattern.test(url.hostname))) {
      const path = url.pathname;
      const compatible = platform === "youtube" ? (url.hostname === "youtu.be" ? path.length > 1 : ["/watch", "/shorts/", "/embed/"].some((prefix) => path.startsWith(prefix)))
        : platform === "instagram" ? /^\/(?:reel|reels|p|tv)\//i.test(path)
        : platform === "twitter" ? /^\/[^/]+\/status\/\d+/i.test(path)
        : url.hostname === "clips.twitch.tv" ? path.length > 1 : /^\/[^/]+\/clip\//i.test(path);
      if (!compatible) throw new AppError(400, "UNSUPPORTED_URL", "Essa URL não é compatível com o tipo de conteúdo suportado.");
      return platform;
    }
  }
  throw new AppError(400, "UNSUPPORTED_PLATFORM", "Essa plataforma ainda não é suportada.");
}

function isPrivate(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const n = ip.split(".").map(Number);
    return n[0] === 10 || n[0] === 127 || n[0] === 0 || (n[0] === 169 && n[1] === 254) || (n[0] === 172 && (n[1] ?? 0) >= 16 && (n[1] ?? 0) <= 31) || (n[0] === 192 && n[1] === 168) || (n[0] === 100 && (n[1] ?? 0) >= 64 && (n[1] ?? 0) <= 127);
  }
  const normalized = ip.toLowerCase();
  return normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb") || normalized.startsWith("::ffff:127.") || normalized.startsWith("::ffff:10.") || normalized.startsWith("::ffff:192.168.");
}

export async function validatePublicUrl(input: string): Promise<{ url: string; platform: Platform }> {
  if (Buffer.byteLength(input) > 2048) throw new AppError(413, "URL_TOO_LONG", "Link inválido.");
  const platform = detectPlatform(input);
  const url = new URL(input);
  const records = await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (!records.length || records.some((record) => isPrivate(record.address))) throw new AppError(400, "UNSAFE_URL", "Link inválido.");
  url.hash = "";
  return { url: url.toString(), platform };
}
