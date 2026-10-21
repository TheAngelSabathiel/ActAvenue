"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { useToastOn } from "@/lib/use-toast-on";
import { createClient } from "@/lib/supabase/client";

type FormProps = {
  /** Called after a successful sign in or sign up with a session. */
  onDone?: () => void;
  /** Where to send the user after success. Omit to stay on the page. */
  redirectTo?: string;
  /** Rendered under the form (links to the other form). */
  footer?: React.ReactNode;
};

export function LoginForm({ onDone, redirectTo, footer }: FormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  useToastOn(error, "error");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    toast.success("Signed in.");
    onDone?.();
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="aa-input" autoComplete="email" />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className="aa-input" autoComplete="current-password" />
        {error && <p className="text-sm text-danger font-bold mb-0">{error}</p>}
        <button type="submit" disabled={submitting} className="aa-btn aa-btn-lg w-full">
          {submitting ? "Signing in..." : "Sign In"}
        </button>
      </form>
      {footer}
    </>
  );
}

export function SignupForm({ onDone, redirectTo, footer, defaultEmail = "", defaultName = "" }: FormProps & { defaultEmail?: string; defaultName?: string }) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [isActor, setIsActor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useToastOn(error, "error");
  const [submitting, setSubmitting] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: name,
          // Only 'actor' is ever recognized from this field (see
          // handle_new_user in schema.sql); there is no client way to
          // request admin or organizer.
          account_type: isActor ? "actor" : "public",
        },
      },
    });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      toast.success("Account created.");
      onDone?.();
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } else {
      toast.success("Account created. Check your email to confirm it.");
      setCheckEmail(true);
    }
  }

  if (checkEmail) {
    return (
      <div className="aa-card p-6">
        <p className="mb-0">
          Check <strong>{email}</strong> for a confirmation link, then come back and sign in.
        </p>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required className="aa-input" autoComplete="name" />
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="aa-input" autoComplete="email" />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="aa-input" autoComplete="new-password" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActor} onChange={(e) => setIsActor(e.target.checked)} />
          I&apos;m an actor or production member
        </label>
        {error && <p className="text-sm text-danger font-bold mb-0">{error}</p>}
        <button type="submit" disabled={submitting} className="aa-btn aa-btn-lg w-full">
          {submitting ? "Creating..." : "Create Account"}
        </button>
      </form>
      {footer}
    </>
  );
}
