"use client";

import { useEffect, useState } from "react";

export const NO_COUNT_KEY = "aa_nocount";

/** True when this visitor turned visit counting off. */
export function visitCountingOff(): boolean {
  try {
    return localStorage.getItem(NO_COUNT_KEY) === "1";
  } catch {
    return false;
  }
}

/** Switch on the Cookie Policy that lets a visitor turn the anonymous visit counting off. */
export function VisitCountingSwitch() {
  const [off, setOff] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOff(visitCountingOff());
  }, []);

  function toggle() {
    const next = !off;
    try {
      if (next) {
        localStorage.setItem(NO_COUNT_KEY, "1");
        localStorage.removeItem("aa_vid");
      } else {
        localStorage.removeItem(NO_COUNT_KEY);
      }
    } catch {
      /* storage blocked: nothing is counted anyway */
    }
    setOff(next);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border border-black/15 p-3 mb-2">
      <p className="text-sm mb-0">
        Visit counting is <strong>{off ? "off" : "on"}</strong> in this browser.
      </p>
      <button type="button" onClick={toggle} className="aa-btn aa-btn-outline aa-btn-sm">
        {off ? "Turn on" : "Turn off"}
      </button>
    </div>
  );
}
