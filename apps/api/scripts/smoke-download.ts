import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../src/app.js";

// Opt-in integration check: downloads Blender's public Big Buck Bunny sample.
// Set SMOKE_API_URL to check an existing deployment instead of a local server.
const server = process.env.SMOKE_API_URL ? undefined : createApp().listen(0, "127.0.0.1");
if (server) await once(server, "listening");
const address = server?.address();
const base = process.env.SMOKE_API_URL ?? `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
const url = "https://www.youtube.com/watch?v=aqz-KE-bpKQ";
async function post(route: string, body: object) {
  const response = await fetch(`${base}${route}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(120_000) });
  const data = await response.json();
  assert(response.ok, `${route}: ${JSON.stringify(data)}`);
  return data;
}
try {
  const info = await post("/api/analyze", { url });
  console.log("Metadata OK:", info.title);
  for (const formatId of ["audio-128", "video-360"]) {
    assert(info.formats.some((format: { id: string }) => format.id === formatId));
    let job = await post("/api/downloads", { url, formatId });
    const deadline = Date.now() + 15 * 60_000;
    let lastStatus = "";
    while (!["ready", "failed"].includes(job.status)) {
      assert(Date.now() < deadline, "Download timeout");
      if (job.status !== lastStatus) console.log(formatId, job.status);
      lastStatus = job.status;
      await new Promise(resolve => setTimeout(resolve, 1000));
      const response = await fetch(`${base}/api/jobs/${job.id}`);
      assert(response.ok);
      job = await response.json();
    }
    assert.equal(job.status, "ready", job.error);
    const response = await fetch(`${base}${job.downloadUrl}`);
    assert(response.ok);
    const audio = formatId.startsWith("audio");
    assert.equal(response.headers.get("content-type"), audio ? "audio/mpeg" : "video/mp4");
    assert(response.headers.get("content-disposition")?.includes(audio ? ".mp3" : ".mp4"));
    let size = 0;
    let prefix = Buffer.alloc(0);
    for await (const chunk of response.body!) {
      const buffer = Buffer.from(chunk);
      if (prefix.length < 32) prefix = Buffer.concat([prefix, buffer.subarray(0, 32 - prefix.length)]);
      size += buffer.length;
    }
    assert.equal(size, Number(response.headers.get("content-length")));
    assert(size > 1024);
    assert(audio ? prefix.toString("ascii", 0, 3) === "ID3" || prefix[0] === 0xff : prefix.toString("ascii", 4, 8) === "ftyp");
    console.log(formatId, "stream OK", size, "bytes");
  }
} finally {
  server?.close();
}
