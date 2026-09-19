import type { Platform } from "@installall/shared";
import type { Provider } from "./types.js";
import { youtubeProvider } from "./youtube.js";
import { instagramProvider } from "./instagram.js";
import { twitterProvider } from "./twitter.js";
import { twitchProvider } from "./twitch.js";
const providers: Record<Platform, Provider> = { youtube: youtubeProvider, instagram: instagramProvider, twitter: twitterProvider, twitch: twitchProvider };
export const getProvider = (platform: Platform): Provider => providers[platform]!;
