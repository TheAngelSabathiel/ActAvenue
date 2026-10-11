"use client";

import { useEffect } from "react";
import { toast, type ToastKind } from "@/lib/toast";

/** Pops a toast whenever `message` becomes a non-empty string. */
export function useToastOn(message: string | null | undefined, kind: ToastKind) {
  useEffect(() => {
    if (message) toast[kind](message);
  }, [message, kind]);
}
