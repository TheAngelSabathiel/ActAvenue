"use client";

import { useState } from "react";
import Link from "next/link";
import { getGame } from "@/lib/games";

/** A multiple choice quiz that ends on a result card. The questions and results live in lib/games.ts. */
export function QuizGame({ slug }: { slug: string }) {
  const game = getGame(slug);
  const [answers, setAnswers] = useState<string[]>([]);
  const [started, setStarted] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!game) return null;

  const step = answers.length;
  const done = step >= game.questions.length;

  function restart() {
    setAnswers([]);
    setStarted(false);
    setCopied(false);
  }

  /** Most picked result wins. A tie goes to the one picked last. */
  function pick(): string {
    const tally: Record<string, number> = {};
    for (const a of answers) tally[a] = (tally[a] ?? 0) + 1;
    const best = Math.max(...Object.values(tally));
    for (let i = answers.length - 1; i >= 0; i--) if (tally[answers[i]] === best) return answers[i];
    return answers[0];
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(game!.promoCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the code stays visible to copy by hand */
    }
  }

  async function share(text: string) {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) await navigator.share({ title: game!.name, text, url });
      else await navigator.clipboard.writeText(`${text} ${url}`);
    } catch {
      /* share cancelled */
    }
  }

  if (!started) {
    return (
      <div className="aa-container max-w-xl py-12 sm:py-16 text-center">
        <p className="text-xs font-black uppercase tracking-[0.2em] mb-3">{game.eyebrow}</p>
        <h1 className="text-4xl sm:text-5xl mb-4">{game.name}</h1>
        <p className="text-lg mb-8">{game.intro}</p>
        <button type="button" onClick={() => setStarted(true)} className="aa-btn aa-btn-black aa-btn-lg w-full sm:w-auto">
          Start
        </button>
        <Link href="/play" className="block mt-6 text-xs font-bold uppercase underline">
          All games
        </Link>
      </div>
    );
  }

  if (!done) {
    const item = game.questions[step];
    return (
      <div className="aa-container max-w-xl py-10 sm:py-14">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-black uppercase tracking-[0.15em] mb-0">
            Question {step + 1} of {game.questions.length}
          </p>
          {step > 0 && (
            <button type="button" onClick={() => setAnswers((a) => a.slice(0, -1))} className="text-xs font-bold uppercase underline">
              Back
            </button>
          )}
        </div>
        <div className="h-1.5 bg-[#e9ecef] mb-8" aria-hidden="true">
          <div className="h-1.5 bg-black transition-all duration-300" style={{ width: `${(step / game.questions.length) * 100}%` }} />
        </div>
        <h2 className="text-2xl sm:text-3xl mb-6">{item.q}</h2>
        <div className="flex flex-col gap-3">
          {item.options.map((o) => (
            <button
              key={o.text}
              type="button"
              onClick={() => setAnswers((a) => [...a, o.result])}
              className="aa-card aa-lift text-left p-4 text-base min-h-14 w-full"
            >
              {o.text}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const r = game.results[pick()];
  return (
    <div className="aa-container max-w-xl py-10 sm:py-14">
      <div className="bg-black text-white p-6 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-white mb-2">{r.leadLabel}</p>
        <p className="text-xl sm:text-2xl font-bold text-white mb-6">{r.lead}</p>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-white mb-1">
          {r.titleLabel}
          {r.tag ? ` · ${r.tag}` : ""}
        </p>
        <h1 className="text-3xl sm:text-4xl text-white mb-3">{r.title}</h1>
        <p className="text-base text-white mb-0">{r.blurb}</p>
      </div>

      <div className="aa-card p-5 mt-4">
        <p className="font-black mb-1">{game.show.title}</p>
        <p className="text-sm mb-0">{game.show.line}</p>
      </div>

      {game.promoCode && (
        <div className="aa-card p-5 mt-4 text-center">
          <p className="text-xs font-black uppercase tracking-[0.15em] mb-2">{game.promoLabel}</p>
          <p className="text-3xl font-black tracking-[0.15em] mb-3">{game.promoCode}</p>
          <button type="button" onClick={copyCode} className="aa-btn aa-btn-outline aa-btn-sm mb-2">
            {copied ? "Copied" : "Copy code"}
          </button>
          <p className="text-sm text-muted mb-0">{game.promoNote}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mt-6">
        <Link href="/#now-showing" className="aa-btn aa-btn-black flex-1 text-center">
          Get tickets
        </Link>
        <button type="button" onClick={() => share(game.shareText(r))} className="aa-btn aa-btn-outline flex-1">
          Share my result
        </button>
      </div>
      <div className="flex justify-center gap-6 mt-5">
        <button type="button" onClick={restart} className="text-xs font-bold uppercase underline">
          Take it again
        </button>
        <Link href="/play" className="text-xs font-bold uppercase underline">
          All games
        </Link>
      </div>
    </div>
  );
}
