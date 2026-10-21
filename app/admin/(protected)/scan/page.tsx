"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import jsQR from "jsqr";
import { formatDateTime } from "@/lib/datetime";
import { inScanWindow } from "@/lib/ticket-code";

type Show = { id: string; label: string; datetime: string; venue: string; production: string; total: number; admitted: number };
type Ticket = { label: string; used: number; quantity: number };
type Result =
  | { status: "admitted"; buyer: string; code: string; admitted: number; remaining: number; quantity: number; tickets: Ticket[] }
  | { status: "choose"; buyer: string; code: string; remaining: number; quantity: number; tickets: Ticket[] }
  | { status: "error"; message: string; buyer?: string; code?: string; kind?: string; canOverride?: boolean; tickets?: Ticket[] };

type Mode = "all" | "one" | "ask";
const SHOW_KEY = "aa-scan-show";
const MODE_KEY = "aa-scan-mode";

function beep(ok: boolean) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const tone = (freq: number, at: number, len: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = freq;
      g.gain.value = 0.15;
      o.connect(g);
      g.connect(ctx.destination);
      o.start(ctx.currentTime + at);
      o.stop(ctx.currentTime + at + len);
    };
    if (ok) tone(880, 0, 0.12);
    else {
      tone(220, 0, 0.18);
      tone(220, 0.24, 0.18);
    }
    setTimeout(() => ctx.close(), 800);
  } catch {
    /* sound is a nicety */
  }
  try {
    navigator.vibrate?.(ok ? 60 : [120, 80, 120]);
  } catch {
    /* ignore */
  }
}

function ScanScreen() {
  const params = useSearchParams();
  const linkCode = params.get("code");

  const [shows, setShows] = useState<Show[]>([]);
  const [showId, setShowId] = useState("");
  const [mode, setMode] = useState<Mode>("all");
  const [running, setRunning] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [manual, setManual] = useState("");
  const [torch, setTorch] = useState(false);
  const [canTorch, setCanTorch] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const busy = useRef(false);
  const last = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const showRef = useRef("");
  const modeRef = useRef<Mode>("all");
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const linkDone = useRef(false);

  useEffect(() => {
    showRef.current = showId;
    try { if (showId) localStorage.setItem(SHOW_KEY, showId); } catch { /* ignore */ }
  }, [showId]);
  useEffect(() => {
    modeRef.current = mode;
    try { localStorage.setItem(MODE_KEY, mode); } catch { /* ignore */ }
  }, [mode]);

  const loadShows = useCallback(async () => {
    const res = await fetch("/api/checkin/shows");
    const d = await res.json().catch(() => ({}));
    const list: Show[] = d.shows ?? [];
    setShows(list);
    return list;
  }, []);

  // Pick a show: the one remembered on this phone, else the one open for scanning now, else the next one.
  useEffect(() => {
    (async () => {
      const list = await loadShows();
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(SHOW_KEY);
        const m = localStorage.getItem(MODE_KEY) as Mode | null;
        if (m === "all" || m === "one" || m === "ask") setMode(m);
      } catch { /* ignore */ }
      const pick =
        list.find((s) => s.id === saved) ??
        list.find((s) => inScanWindow(s.datetime).ok) ??
        list.find((s) => new Date(s.datetime).getTime() > Date.now()) ??
        list[0];
      if (pick) setShowId(pick.id);
    })();
  }, [loadShows]);

  const scan = useCallback(
    async (text: string, opts: { mode?: Mode; override?: boolean } = {}) => {
      if (busy.current) return;
      busy.current = true;
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      try {
        const res = await fetch("/api/checkin/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: text, performance_id: showRef.current || null, mode: opts.mode ?? modeRef.current, override: !!opts.override }),
        });
        const d = (await res.json().catch(() => ({ status: "error", message: "Could not reach the server." }))) as Result;
        const r: Result = res.ok ? d : { status: "error", message: (d as { error?: string }).error ?? "Not allowed." };
        setResult(r);
        beep(r.status !== "error");
        if (r.status === "admitted") {
          loadShows();
          dismissTimer.current = setTimeout(() => setResult(null), 1400);
        }
      } finally {
        busy.current = false;
      }
    },
    [loadShows]
  );

  // A ticket link opened by phone camera or Viber lands here with ?code=
  useEffect(() => {
    if (!linkCode || linkDone.current) return;
    (async () => {
      let sid = showRef.current;
      if (!sid) {
        const d = await fetch(`/api/checkin/scan?code=${encodeURIComponent(linkCode)}`).then((r) => r.json()).catch(() => ({}));
        if (d.performance_id) {
          sid = d.performance_id;
          setShowId(sid);
          showRef.current = sid;
        }
      }
      if (!sid) return;
      linkDone.current = true;
      scan(linkCode);
    })();
  }, [linkCode, showId, scan]);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setRunning(false);
    setTorch(false);
  }, []);
  useEffect(() => stop, [stop]);

  async function start() {
    setCamError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      stream.current = s;
      const v = video.current!;
      v.srcObject = s;
      await v.play();
      const caps = s.getVideoTracks()[0]?.getCapabilities?.() as { torch?: boolean } | undefined;
      setCanTorch(!!caps?.torch);
      setRunning(true);
    } catch {
      setCamError("Could not open the camera. Allow camera access in your browser, or type the code below.");
    }
  }

  async function toggleTorch() {
    const track = stream.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torch;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorch(next);
    } catch {
      /* not supported */
    }
  }

  // Read frames while the camera is on.
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let lastTick = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - lastTick < 90) return; // about 11 reads a second
      lastTick = t;
      const v = video.current;
      const c = canvas.current;
      if (!v || !c || v.readyState < 2 || busy.current) return;
      const w = Math.min(640, v.videoWidth);
      const h = Math.round((v.videoHeight / v.videoWidth) * w);
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, w, h);
      const img = ctx.getImageData(0, 0, w, h);
      const hit = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
      if (!hit?.data) return;
      const now = Date.now();
      if (hit.data === last.current.text && now - last.current.at < 2500) return;
      last.current = { text: hit.data, at: now };
      scan(hit.data);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, scan]);

  const show = shows.find((s) => s.id === showId);
  const win = show ? inScanWindow(show.datetime, now) : null;
  const tone = result?.status === "admitted" ? "bg-green-700" : result?.status === "choose" ? "bg-black" : "bg-danger";

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h1 className="font-extrabold text-3xl">Scan tickets</h1>

      <div className="aa-card p-4 space-y-3">
        <label className="block">
          <span className="aa-label">Show</span>
          <select value={showId} onChange={(e) => setShowId(e.target.value)} className="aa-input mt-1">
            {shows.length === 0 && <option value="">No upcoming shows</option>}
            {shows.map((s) => (
              <option key={s.id} value={s.id}>
                {s.production} · {s.label} · {formatDateTime(s.datetime)}
              </option>
            ))}
          </select>
        </label>
        {show && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-bold tabular-nums">Admitted {show.admitted} of {show.total}</span>
            <span className={win?.ok ? "text-green-700 font-bold" : "text-danger font-bold"}>
              {win?.ok ? "Scanning open" : now < (win?.opensAt ?? 0) ? `Opens ${formatDateTime(new Date(win!.opensAt).toISOString())}` : "Scanning closed"}
            </span>
          </div>
        )}
        <label className="block">
          <span className="aa-label">Groups (a QR with more than one ticket)</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} className="aa-input mt-1">
            <option value="all">Admit all remaining on one scan</option>
            <option value="one">Admit 1 per scan</option>
            <option value="ask">Ask me each time</option>
          </select>
        </label>
      </div>

      <div className="relative bg-black overflow-hidden aspect-[3/4] sm:aspect-video">
        <video ref={video} playsInline muted className={`absolute inset-0 w-full h-full object-cover ${running ? "" : "hidden"}`} />
        <canvas ref={canvas} className="hidden" />
        {!running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white p-6 text-center">
            <p className="mb-0">Point the camera at a ticket QR.</p>
            <button onClick={start} className="aa-btn aa-btn-light aa-btn-lg" disabled={!showId}>Start scanning</button>
            {camError && <p className="text-sm text-red-300 mb-0">{camError}</p>}
          </div>
        )}
        {running && (
          <>
            <div className="absolute inset-[18%] border-2 border-white/80 pointer-events-none" />
            <div className="absolute top-3 right-3 flex gap-2">
              {canTorch && <button onClick={toggleTorch} className="aa-btn aa-btn-sm aa-btn-light">{torch ? "Light off" : "Light"}</button>}
              <button onClick={stop} className="aa-btn aa-btn-sm aa-btn-light">Stop</button>
            </div>
          </>
        )}

        {result && (
          <div className={`absolute inset-x-0 bottom-0 ${tone} text-white p-5 space-y-2`} role="status" aria-live="assertive">
            {result.status === "admitted" && (
              <>
                <p className="text-3xl font-black mb-0">Admit {result.admitted}</p>
                <p className="text-lg font-bold mb-0">{result.buyer}</p>
                <p className="text-sm mb-0">{result.tickets.map((t) => `${t.label} ${t.used}/${t.quantity}`).join(" · ")}</p>
              </>
            )}
            {result.status === "choose" && (
              <>
                <p className="text-2xl font-black mb-0">{result.buyer}</p>
                <p className="text-sm mb-0">{result.remaining} of {result.quantity} left to admit. {result.tickets.map((t) => `${t.label} ${t.used}/${t.quantity}`).join(" · ")}</p>
                <div className="flex gap-2 pt-1">
                  <button className="aa-btn aa-btn-light flex-1" onClick={() => scan(result.code, { mode: "one" })}>Admit 1</button>
                  <button className="aa-btn aa-btn-light flex-1" onClick={() => scan(result.code, { mode: "all" })}>Admit all {result.remaining}</button>
                </div>
                <button className="underline text-sm" onClick={() => setResult(null)}>Cancel</button>
              </>
            )}
            {result.status === "error" && (
              <>
                <p className="text-2xl font-black mb-0">Not admitted</p>
                {result.buyer && <p className="text-lg font-bold mb-0">{result.buyer}</p>}
                <p className="mb-0">{result.message}</p>
                <div className="flex gap-2 pt-1">
                  {result.canOverride && result.code && (
                    <button className="aa-btn aa-btn-light flex-1" onClick={() => scan(result.code!, { override: true })}>Override and admit</button>
                  )}
                  <button className="aa-btn aa-btn-light flex-1" onClick={() => setResult(null)}>Next</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim()) {
            scan(manual);
            setManual("");
          }
        }}
      >
        <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Or type a ticket or reference code" className="aa-input flex-1 uppercase" />
        <button className="aa-btn">Admit</button>
      </form>
    </div>
  );
}

export default function ScanPage() {
  return (
    <Suspense fallback={null}>
      <ScanScreen />
    </Suspense>
  );
}
