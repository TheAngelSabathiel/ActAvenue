"use client";

import { useState } from "react";
import Link from "next/link";

/** The promo code shown on the result screen. Change it here if the code changes. */
const PROMO_CODE = "AAENJOY";

type Play = "interview" | "stopover" | "fine";

const PLAYS: Record<
  Play,
  { title: string; tag: string; order: string; blurb: string }
> = {
  interview: {
    title: "The Interview",
    tag: "Realism",
    order: "Black americano. No sugar. Nothing hidden.",
    blurb:
      "A premarital interview turns into a meeting with the past when Thea faces Father Rex. Some things were never said, and now they have to be.",
  },
  stopover: {
    title: "Stop Over!",
    tag: "Abstract",
    order: "Brewed coffee, refilled twice. You stopped for a quick cup and stayed for the talk.",
    blurb:
      "John and Cedie, longtime friends, pause on a trip north. Over a meal, old jokes make room for big questions about the paths they took.",
  },
  fine: {
    title: "I'm Fine, Darling",
    tag: "Mind play",
    order: "Iced matcha, extra sweet. Looks easy, hides plenty.",
    blurb:
      "A blind date between two strangers starts as playful banter and turns into a talk about everything people tuck behind the words \"I'm fine.\"",
  },
};

const QUESTIONS: { q: string; options: { text: string; play: Play }[] }[] = [
  {
    q: "How do you take your coffee?",
    options: [
      { text: "Black. No sugar, no nonsense.", play: "interview" },
      { text: "Whatever is hot, with a free refill.", play: "stopover" },
      { text: "Sweet and iced. Easy on the surface.", play: "fine" },
    ],
  },
  {
    q: "Someone asks, \"How are you?\"",
    options: [
      { text: "I answer honestly, even if it gets awkward.", play: "interview" },
      { text: "I tell a story. It is a long one.", play: "stopover" },
      { text: "\"I'm fine.\" Next question.", play: "fine" },
    ],
  },
  {
    q: "Pick a seat.",
    options: [
      { text: "Right across from someone, eye to eye.", play: "interview" },
      { text: "By the window, watching the road.", play: "stopover" },
      { text: "The corner, back to the wall.", play: "fine" },
    ],
  },
  {
    q: "What replays in your head at 2 AM?",
    options: [
      { text: "Something I never got to say.", play: "interview" },
      { text: "The road I did not take.", play: "stopover" },
      { text: "Something I said that was not quite true.", play: "fine" },
    ],
  },
  {
    q: "The best part of a long conversation?",
    options: [
      { text: "When the truth finally comes out.", play: "interview" },
      { text: "The jokes only old friends get.", play: "stopover" },
      { text: "When someone sees right through me.", play: "fine" },
    ],
  },
];

function score(answers: Play[]): Play {
  const tally: Record<Play, number> = { interview: 0, stopover: 0, fine: 0 };
  for (const a of answers) tally[a]++;
  const best = Math.max(...Object.values(tally));
  const leaders = (Object.keys(tally) as Play[]).filter((p) => tally[p] === best);
  // A tie goes to the play picked last.
  for (let i = answers.length - 1; i >= 0; i--) if (leaders.includes(answers[i])) return answers[i];
  return leaders[0];
}

export function OrderYourPatlang() {
  const [answers, setAnswers] = useState<Play[]>([]);
  const [started, setStarted] = useState(false);
  const [copied, setCopied] = useState(false);

  const step = answers.length;
  const done = step >= QUESTIONS.length;

  function restart() {
    setAnswers([]);
    setStarted(false);
    setCopied(false);
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(PROMO_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the code stays visible to copy by hand */
    }
  }

  async function share(play: Play) {
    const p = PLAYS[play];
    const text = `My Patlang order: ${p.order} My play: ${p.title}. Find yours.`;
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) await navigator.share({ title: "Order Your Patlang", text, url });
      else await navigator.clipboard.writeText(`${text} ${url}`);
    } catch {
      /* share cancelled */
    }
  }

  if (!started) {
    return (
      <div className="aa-container max-w-xl py-12 sm:py-16 text-center">
        <p className="text-xs font-black uppercase tracking-[0.2em] mb-3">Patlang at Cafe Xia</p>
        <h1 className="text-4xl sm:text-5xl mb-4">Order Your Patlang</h1>
        <p className="text-lg mb-8">Five questions. One coffee order. One play that fits you.</p>
        <button type="button" onClick={() => setStarted(true)} className="aa-btn aa-btn-black aa-btn-lg w-full sm:w-auto">
          Start
        </button>
      </div>
    );
  }

  if (!done) {
    const item = QUESTIONS[step];
    return (
      <div className="aa-container max-w-xl py-10 sm:py-14">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-black uppercase tracking-[0.15em] mb-0">
            Question {step + 1} of {QUESTIONS.length}
          </p>
          {step > 0 && (
            <button type="button" onClick={() => setAnswers((a) => a.slice(0, -1))} className="text-xs font-bold uppercase underline">
              Back
            </button>
          )}
        </div>
        <div className="h-1.5 bg-[#e9ecef] mb-8" aria-hidden="true">
          <div className="h-1.5 bg-black transition-all duration-300" style={{ width: `${(step / QUESTIONS.length) * 100}%` }} />
        </div>
        <h2 className="text-2xl sm:text-3xl mb-6">{item.q}</h2>
        <div className="flex flex-col gap-3">
          {item.options.map((o) => (
            <button
              key={o.text}
              type="button"
              onClick={() => setAnswers((a) => [...a, o.play])}
              className="aa-card aa-lift text-left p-4 text-base min-h-14 w-full"
            >
              {o.text}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const result = score(answers);
  const p = PLAYS[result];
  return (
    <div className="aa-container max-w-xl py-10 sm:py-14">
      <div className="bg-black text-white p-6 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-white mb-2">Your Patlang order</p>
        <p className="text-xl sm:text-2xl font-bold text-white mb-6">{p.order}</p>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-white mb-1">Your play · {p.tag}</p>
        <h1 className="text-3xl sm:text-4xl text-white mb-3">{p.title}</h1>
        <p className="text-base text-white mb-0">{p.blurb}</p>
      </div>

      <div className="aa-card p-5 mt-4">
        <p className="font-black mb-1">See it live</p>
        <p className="text-sm mb-0">Cafe Xia, 2735 Taft Avenue, Pasay City. Nov 14 and 15, 3 PM and 7 PM.</p>
      </div>

      <div className="aa-card p-5 mt-4 text-center">
        <p className="text-xs font-black uppercase tracking-[0.15em] mb-2">Your reward for our next show</p>
        <p className="text-3xl font-black tracking-[0.15em] mb-3">{PROMO_CODE}</p>
        <button type="button" onClick={copyCode} className="aa-btn aa-btn-outline aa-btn-sm mb-2">
          {copied ? "Copied" : "Copy code"}
        </button>
        <p className="text-sm text-muted mb-0">Enter it at checkout. Limited uses.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mt-6">
        <Link href="/#now-showing" className="aa-btn aa-btn-black flex-1 text-center">
          Get tickets
        </Link>
        <button type="button" onClick={() => share(result)} className="aa-btn aa-btn-outline flex-1">
          Share my order
        </button>
      </div>
      <button type="button" onClick={restart} className="block mx-auto mt-5 text-xs font-bold uppercase underline">
        Take it again
      </button>
    </div>
  );
}
