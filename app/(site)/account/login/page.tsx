"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/account");
    router.refresh();
  }

  return (
    <div className="aa-container max-w-sm py-16">
      <h1 className="text-3xl mb-2">Sign In</h1>
      <hr className="aa-divider" />
      <p className="text-muted mb-6">An account is optional. It keeps your ticket history in one place.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="aa-input" />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className="aa-input" />
        {error && <p className="text-sm text-danger font-bold mb-0">{error}</p>}
        <button type="submit" disabled={submitting} className="aa-btn aa-btn-lg w-full">
          {submitting ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <p className="text-sm text-muted mt-6">
        No account yet?{" "}
        <Link href="/account/signup" className="text-black font-bold underline">Create one</Link>
        {" or "}
        <Link href="/cart" className="text-black font-bold underline">continue as guest</Link>
      </p>
    </div>
  );
}
