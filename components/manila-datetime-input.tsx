"use client";

import { useState } from "react";

type Props = {
  /** "YYYY-MM-DDTHH:mm" in Philippine time, or "". Omit for an uncontrolled field in a plain form. */
  value?: string;
  onChange?: (value: string) => void;
  /** Form field name. Submits "YYYY-MM-DDTHH:mm" in Philippine time. */
  name?: string;
  required?: boolean;
  /** Time used when only a date has been picked. Shows are usually evenings; "until" fields end the day. */
  defaultTime?: string;
  ariaLabel?: string;
  className?: string;
};

const box = "border border-ink/20 px-2 py-1.5 text-sm bg-white";

/**
 * Date and time in Philippine time (PHT). Picking a date never snaps the time
 * to 12:00 AM: the time starts at `defaultTime` and stays wherever it is set.
 */
export function ManilaDateTimeInput({
  value,
  onChange,
  name,
  required,
  defaultTime = "19:00",
  ariaLabel,
  className = "",
}: Props) {
  const [inner, setInner] = useState("");
  const current = value ?? inner;
  const [date = "", time = ""] = current ? current.split("T") : [];

  function emit(nextDate: string, nextTime: string) {
    const next = nextDate ? `${nextDate}T${nextTime || defaultTime}` : "";
    if (value === undefined) setInner(next);
    onChange?.(next);
  }

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <input
        type="date"
        value={date}
        required={required}
        onChange={(e) => emit(e.target.value, time)}
        className={`${box} min-w-0 flex-1 basis-32 max-w-[11rem]`}
        aria-label={ariaLabel ? `${ariaLabel} (date)` : "Date"}
      />
      <input
        type="time"
        value={time}
        step={300}
        disabled={!date}
        onChange={(e) => emit(date, e.target.value)}
        className={`${box} min-w-0 flex-1 basis-28 max-w-[9rem] disabled:opacity-50`}
        aria-label={ariaLabel ? `${ariaLabel} (time)` : "Time"}
      />
      <span className="text-xs font-bold uppercase text-muted">PHT</span>
      {name && <input type="hidden" name={name} value={current} />}
    </div>
  );
}
