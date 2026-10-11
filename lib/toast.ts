export type ToastKind = "success" | "error" | "info";
export type ToastMessage = { id: number; kind: ToastKind; text: string };

type Listener = (t: ToastMessage) => void;
const listeners = new Set<Listener>();
let nextId = 1;

function push(kind: ToastKind, text: string) {
  const t = { id: nextId++, kind, text };
  listeners.forEach((l) => l(t));
}

/** Show a pop-up message from anywhere in client code: toast.success("Saved"). */
export const toast = {
  success: (text: string) => push("success", text),
  error: (text: string) => push("error", text),
  info: (text: string) => push("info", text),
};

export function subscribeToasts(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
