"use client";
/* Thumbnail URLs are extractor output and intentionally load in the browser. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import type { DownloadJob, MediaFormat, MediaInfo } from "@installall/shared";
import { analyze, API_URL, getJob, startDownload } from "../lib/api";
import { DownloadIcon, LinkIcon, MoonIcon, SunIcon, TrashIcon } from "./icons";

type HistoryItem = { title: string; platform: string; format: string; date: number };
const platformName = { youtube: "YouTube", instagram: "Instagram", twitter: "X / Twitter", twitch: "Twitch" };
const stageName: Record<DownloadJob["status"], string> = { queued: "Preparando...", downloading: "Baixando...", converting: "Convertendo...", finalizing: "Finalizando...", ready: "Download pronto", failed: "Falha no download" };
const duration = (seconds?: number) => seconds == null ? "—" : `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
const bytes = (value?: number) => value == null ? "Não informado" : `${(value / 1024 / 1024).toFixed(value > 100 * 1024 * 1024 ? 0 : 1)} MB`;

export function Downloader() {
  const [url, setUrl] = useState(""); const [info, setInfo] = useState<MediaInfo | null>(null);
  const [formatId, setFormatId] = useState(""); const [kind, setKind] = useState<"video" | "audio">("video");
  const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [job, setJob] = useState<DownloadJob | null>(null);
  const [dark, setDark] = useState(false); const [history, setHistory] = useState<HistoryItem[]>([]);
  useEffect(() => { const saved = localStorage.getItem("installall-theme"); const value = saved ? saved === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; setDark(value); document.documentElement.dataset.theme = value ? "dark" : "light"; try { setHistory(JSON.parse(localStorage.getItem("installall-history") ?? "[]") as HistoryItem[]); } catch {} }, []);
  const formats = useMemo(() => info?.formats.filter((f) => f.kind === kind) ?? [], [info, kind]);
  const selected = info?.formats.find((f) => f.id === formatId);
  useEffect(() => { const first = formats[0]; if (first && !formats.some((f) => f.id === formatId)) setFormatId(first.id); }, [formats, formatId]);
  useEffect(() => { if (!job || ["ready", "failed"].includes(job.status)) return; const timer = setInterval(() => void getJob(job.id).then(setJob).catch((e: Error) => setError(e.message)), 1000); return () => clearInterval(timer); }, [job]);
  useEffect(() => { if (job?.status !== "ready" || !info || !selected) return; const item = { title: info.title, platform: platformName[info.platform], format: selected.label, date: Date.now() }; const next = [item, ...history].slice(0, 8); setHistory(next); localStorage.setItem("installall-history", JSON.stringify(next)); window.location.assign(`${API_URL}${job.downloadUrl}`); /* only once */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.status]);
  function toggleTheme() { const next = !dark; setDark(next); document.documentElement.dataset.theme = next ? "dark" : "light"; localStorage.setItem("installall-theme", next ? "dark" : "light"); }
  async function submit(e: React.FormEvent) { e.preventDefault(); setLoading(true); setError(""); setInfo(null); setJob(null); try { const value = await analyze(url.trim()); setInfo(value); const first = value.formats.find((f) => f.kind === "video") ?? value.formats[0]; setKind(first?.kind ?? "video"); setFormatId(first?.id ?? ""); } catch (e) { setError(e instanceof Error ? e.message : "Link inválido."); } finally { setLoading(false); } }
  async function download() { if (!formatId) return; setError(""); try { setJob(await startDownload(url.trim(), formatId)); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível iniciar o download."); } }
  function clearHistory() { setHistory([]); localStorage.removeItem("installall-history"); }
  return <main>
    <nav className="nav shell"><a href="#" className="brand"><span className="logo"><DownloadIcon size={19}/></span>Install<span>All</span></a><button className="iconButton" onClick={toggleTheme} aria-label="Alternar tema">{dark ? <SunIcon/> : <MoonIcon/>}</button></nav>
    <section className="hero shell">
      <div className="eyebrow"><span/> Rápido, simples e seguro</div>
      <h1>Baixe seus vídeos<br/>de forma <em>simples.</em></h1>
      <p>Vídeos e áudios em poucos cliques.</p>
      <form className="search" onSubmit={submit}><div className="inputWrap"><LinkIcon/><input aria-label="URL do vídeo" type="url" required maxLength={2048} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Cole o link do vídeo aqui..."/></div><button disabled={loading}>{loading ? <span className="spinner"/> : "Analisar"}</button></form>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="platforms"><span>YouTube</span><i/><span>Instagram</span><i/><span>X</span><i/><span>Twitch</span></div>
    </section>
    {info && <section className="result shell" aria-live="polite"><div className="preview">{info.thumbnail ? <img src={info.thumbnail} alt="Thumbnail do vídeo"/> : <div className="noPreview">Sem preview</div>}<span>{duration(info.duration)}</span></div><div className="details"><div className="platformTag">{platformName[info.platform]}</div><h2>{info.title}</h2>{info.author && <p className="author">por {info.author}</p>}
      {info.platform === "youtube" && <div className="tabs"><button className={kind === "video" ? "active" : ""} onClick={() => setKind("video")}>Vídeo MP4</button><button className={kind === "audio" ? "active" : ""} onClick={() => setKind("audio")}>Áudio MP3</button></div>}
      <div className="field"><label htmlFor="quality">Qualidade / formato</label><select id="quality" value={formatId} onChange={(e) => setFormatId(e.target.value)}>{formats.map((f: MediaFormat) => <option key={f.id} value={f.id}>{f.label}</option>)}</select></div>
      <div className="estimate"><span>Tamanho estimado</span><strong>{bytes(selected?.estimatedBytes)}</strong></div>
      {job ? <div className={`progress ${job.status}`}><div className="progressTop"><span>{stageName[job.status]}</span><b>{Math.round(job.progress)}%</b></div><div className="track"><span style={{ width: `${job.progress}%` }}/></div>{job.error && <p>{job.error}</p>}</div> : <button className="download" onClick={download} disabled={!formatId}><DownloadIcon/> Baixar {kind === "audio" ? "áudio" : "vídeo"}</button>}
    </div></section>}
    {history.length > 0 && <section className="history shell"><div className="sectionHead"><div><span>NO SEU NAVEGADOR</span><h2>Últimos downloads</h2></div><button onClick={clearHistory}><TrashIcon/> Limpar histórico</button></div><div className="historyList">{history.map((item) => <div className="historyItem" key={`${item.date}-${item.title}`}><span className="fileIcon"><DownloadIcon/></span><div><strong>{item.title}</strong><p>{item.platform} · {item.format}</p></div><time>{new Date(item.date).toLocaleDateString("pt-BR")}</time></div>)}</div></section>}
    <footer><div className="shell"><span className="brand small"><span className="logo"><DownloadIcon size={15}/></span>Install<span>All</span></span><p>Baixe apenas conteúdos que você tem permissão para usar.</p><span>Privacidade em primeiro lugar.</span></div></footer>
  </main>;
}
