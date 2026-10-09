"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    // Buyer accounts can sign in with valid credentials too - without this
    // check they'd land here successfully, then get silently bounced back
    // to /admin/login by the layout's server-side role check with no
    // explanation. Check role here so there's a clear message instead of a
    // confusing redirect loop, and sign them back out since a non-admin
    // session sitting on the admin login page serves no purpose.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (!profile || !["admin", "organizer"].includes(profile.role)) {
      await supabase.auth.signOut();
      setLoading(false);
      setError("This account doesn't have admin access.");
      return;
    }

    router.push("/admin/reservations");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-black px-4">
      <form onSubmit={handleSubmit} className="aa-card border-t-[6px] !border-t-accent p-8 w-full max-w-sm space-y-4">
        <h1 className="text-2xl text-center mb-0">Admin Sign In</h1>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="aa-input" />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className="aa-input" />
        {error && <p className="text-sm text-danger font-bold mb-0">{error}</p>}
        <button type="submit" disabled={loading} className="aa-btn aa-btn-lg w-full">
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </main>
  );
}
