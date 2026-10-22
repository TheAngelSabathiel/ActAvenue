import { revalidatePath } from "next/cache";

/** Public pages are saved for a minute. Call this after an edit so visitors see it right away. */
export function refreshPublicPages() {
  try {
    revalidatePath("/", "layout");
  } catch {
    /* never block a save because the refresh failed */
  }
}

type Handler<A extends unknown[]> = (...args: A) => Promise<Response>;

/** Wraps an admin or profile write so a successful one refreshes the public pages. */
export function withRefresh<A extends unknown[]>(handler: Handler<A>): Handler<A> {
  return async (...args: A) => {
    const res = await handler(...args);
    if (res.ok) refreshPublicPages();
    return res;
  };
}
