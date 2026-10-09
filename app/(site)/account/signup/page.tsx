"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isActor, setIsActor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: name,
          // Only 'actor' is ever recognized from this field (see
          // handle_new_user in schema.sql) - there's no client-controllable
          // way to request admin/organizer through signup.
          account_type: isActor ? "actor" : "public",
        },
      },
    });

    setSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }

    // If email confirmation is off for this project, signUp returns an
    // active session immediately. Otherwise the buyer needs to confirm
    // via email first.
    if (data.session) {
      router.push("/account");
      router.refresh();
    } else {
      setCheckEmail(true);
    }
  }

  return (
    <div className="aa-container max-w-sm py-16">
      <h1 className="text-3xl mb-2">Create Account</h1>
      <hr className="aa-divider" />
      <p className="text-muted mb-6">Optional. You can also check out as a guest.</p>

      {checkEmail ? (
        <div className="aa-card p-6">
          <p className="mb-0">
            Check <strong>{email}</strong> for a confirmation link, then come back and sign in.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required className="aa-input" />
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="aa-input" />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="aa-input" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActor} onChange={(e) => setIsActor(e.target.checked)} />
            I&apos;m an actor or production member
          </label>
          {error && <p className="text-sm text-danger font-bold mb-0">{error}</p>}
          <button type="submit" disabled={submitting} className="aa-btn aa-btn-lg w-full">
            {submitting ? "Creating..." : "Create Account"}
          </button>
        </form>
      )}

      <p className="text-sm text-muted mt-6">
        Already have an account?{" "}
        <Link href="/account/login" className="text-black font-bold underline">Sign in</Link>
      </p>
    </div>
  );
}
