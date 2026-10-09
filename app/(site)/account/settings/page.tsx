"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/spinner";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { IMAGES } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";
import { validateImageFile } from "@/lib/upload";

type Profile = {
  id: string;
  role: "admin" | "organizer" | "actor" | "public";
  display_name: string | null;
  bio: string | null;
  photo_url: string | null;
  resume_url: string | null;
  reel_url: string | null;
  is_public: boolean;
  is_approved: boolean;
};

type GalleryPhoto = {
  id: string;
  photo_url: string;
  caption: string | null;
  sort_order: number;
};

export default function AccountSettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/account/login");
      return;
    }
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile(data);
    setLoading(false);
  }

  useEffect(() => {
    // Intentional: run once on mount; `load` is also called directly by
    // child sections after a save, not just here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !profile) {
    return (
      <>
        <main className="flex-1 mx-auto max-w-xl w-full px-6 py-12">
          <Spinner label="Loading settings" />
        </main>
      </>
    );
  }

  return (
    <>
      <main className="flex-1 mx-auto max-w-xl w-full px-6 py-12 space-y-10">
        <h1 className="font-extrabold text-3xl">Account settings</h1>

        <ProfilePhotoSection profile={profile} onSaved={load} />

        <PasswordSection />

        {profile.role === "public" && <BecomeActorSection onUpgraded={load} />}
        {(profile.role === "actor" || profile.role === "admin" || profile.role === "organizer") && <ActorProfileSection profile={profile} onSaved={load} />}
        {(profile.role === "actor" || profile.role === "admin" || profile.role === "organizer") && <GallerySection />}

        {profile.role !== "admin" && profile.role !== "organizer" && <DangerZone />}
      </main>
    </>
  );
}

function PasswordSection() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }
    setMessage("Password updated.");
    setPassword("");
    setConfirm("");
  }

  return (
    <section className="aa-card p-6 space-y-4">
      <h2 className="font-extrabold text-xl">Change password</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
          className="w-full border border-ink/20  px-3 py-2 text-sm"
        />
        <input
          type="password"
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={6}
          required
          className="w-full border border-ink/20  px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}
        <button
          disabled={submitting}
          className="px-4 py-2  bg-black text-paper text-sm font-bold uppercase disabled:opacity-50"
        >
          {submitting ? "Updating..." : "Update password"}
        </button>
      </form>
    </section>
  );
}

function BecomeActorSection({ onUpgraded }: { onUpgraded: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/account/become-actor", { method: "POST" });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    onUpgraded();
  }

  return (
    <section className="aa-card p-6 space-y-3">
      <h2 className="font-extrabold text-xl">Actor / production member?</h2>
      <p className="text-sm text-muted">
        Turn on an actor profile to add a setcard - bio, photos, resume, reel - that can be shown
        publicly and tagged to productions you&apos;ve been part of. You can still buy tickets
        normally either way.
      </p>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        onClick={handleClick}
        disabled={submitting}
        className="px-4 py-2  bg-black text-paper text-sm font-bold uppercase disabled:opacity-50"
      >
        {submitting ? "Setting up..." : "Set up actor profile"}
      </button>
    </section>
  );
}

function VisibilityStatus({ isPublic, isApproved }: { isPublic: boolean; isApproved: boolean }) {
  if (!isPublic) {
    return <p className="text-xs text-muted font-bold uppercase">Not listed publicly</p>;
  }
  if (isPublic && !isApproved) {
    return (
      <p className="text-xs font-bold uppercase text-danger bg-accent/20 inline-block px-2 py-0.5 rounded">
        Pending admin review
      </p>
    );
  }
  return (
    <p className="text-xs font-bold uppercase text-success bg-success/10 inline-block px-2 py-0.5 rounded">
      Live in the directory
    </p>
  );
}

function ProfilePhotoSection({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    const invalid = validateImageFile(file);
    if (invalid) return setError(invalid);
    const formData = new FormData();
    formData.append("file", file);
    setBusy(true);
    try {
      const res = await fetch("/api/account/photo", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Upload failed.");
      else onSaved();
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    if (!confirm("Remove your profile photo?")) return;
    setError(null);
    setBusy(true);
    const res = await fetch("/api/account/photo", { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return setError("Could not remove the photo.");
    onSaved();
  }

  return (
    <section className="aa-card p-6">
      <h2 className="font-extrabold text-xl mb-4">Profile photo</h2>
      <div className="flex items-center gap-5">
        <div className="relative h-24 w-24 shrink-0 border-2 border-black overflow-hidden">
          <Image
            key={profile.photo_url ?? "none"}
            src={profile.photo_url ?? IMAGES.headshotPlaceholder}
            alt="Profile photo"
            fill
            sizes="96px"
            className="object-cover"
          />
          {busy && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
              <div className="aa-spinner !w-8 !h-8" />
            </div>
          )}
        </div>
        <div>
          <p className="text-sm text-muted mb-3">Square photo, 400x400 or larger. JPG, PNG or WebP, up to 5 MB.</p>
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => input.current?.click()} className="aa-btn aa-btn-sm">
              {profile.photo_url ? "Replace" : "Upload"}
            </button>
            {profile.photo_url && (
              <button type="button" disabled={busy} onClick={remove} className="aa-btn aa-btn-outline aa-btn-sm">
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
      {error && <p className="text-sm text-danger font-bold mt-3 mb-0">{error}</p>}
    </section>
  );
}

function ActorProfileSection({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [resumeUrl, setResumeUrl] = useState(profile.resume_url ?? "");
  const [reelUrl, setReelUrl] = useState(profile.reel_url ?? "");
  const [isPublic, setIsPublic] = useState(profile.is_public);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    const res = await fetch("/api/account/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: displayName,
        bio,
        resume_url: resumeUrl || null,
        reel_url: reelUrl || null,
        is_public: isPublic,
      }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }
    setMessage("Profile saved.");
    onSaved();
  }

  return (
    <section className="aa-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-extrabold text-xl">Cast &amp; crew profile</h2>
        <VisibilityStatus isPublic={profile.is_public} isApproved={profile.is_approved} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Display name (shown publicly)"
          className="w-full border border-ink/20  px-3 py-2 text-sm"
        />
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Short bio"
          rows={4}
          className="w-full border border-ink/20  px-3 py-2 text-sm"
        />
        <input
          value={resumeUrl}
          onChange={(e) => setResumeUrl(e.target.value)}
          placeholder="Resume link (Google Drive, PDF, etc.)"
          className="w-full border border-ink/20  px-3 py-2 text-sm"
        />
        <input
          value={reelUrl}
          onChange={(e) => setReelUrl(e.target.value)}
          placeholder="Reel link (YouTube, Vimeo, etc.)"
          className="w-full border border-ink/20  px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          Show my profile publicly in the cast &amp; crew directory
        </label>
        {isPublic && !profile.is_approved && (
          <p className="text-xs text-muted">
            An admin reviews new listings before they go live - this usually doesn&apos;t take long.
          </p>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}
        <button
          disabled={submitting}
          className="px-4 py-2  bg-black text-paper text-sm font-bold uppercase disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save profile"}
        </button>
      </form>
    </section>
  );
}

function GallerySection() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [reordering, setReordering] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/account/photos");
    const data = await res.json();
    const sorted = (data.photos ?? []).slice().sort((a: GalleryPhoto, b: GalleryPhoto) => a.sort_order - b.sort_order);
    setPhotos(sorted);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function handleUpload(file: File) {
    setError(null);
    const invalid = validateImageFile(file);
    if (invalid) return setError(invalid);
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/account/photos", { method: "POST", body: formData });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this photo?")) return;
    await fetch(`/api/account/photos/${id}`, { method: "DELETE" });
    load();
  }

  async function handleReplace(id: string, file: File) {
    setError(null);
    const invalid = validateImageFile(file);
    if (invalid) return setError(invalid);
    setReordering(id);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/account/photos/${id}`, { method: "PUT", body: formData });
    const data = await res.json();
    setReordering(null);
    if (!res.ok) return setError(data.error ?? "Could not replace the photo.");
    load();
  }

  async function move(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= photos.length) return;

    const current = photos[index];
    const target = photos[targetIndex];
    setReordering(current.id);

    // Swap sort_order between the two photos.
    await Promise.all([
      fetch(`/api/account/photos/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: target.sort_order }),
      }),
      fetch(`/api/account/photos/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: current.sort_order }),
      }),
    ]);

    setReordering(null);
    load();
  }

  return (
    <section className="aa-card p-6 space-y-4">
      <h2 className="font-extrabold text-xl">Setcard gallery</h2>
      <p className="text-sm text-muted">
        Extra photos shown on your public profile, beyond your main profile photo. Up to 8. Use the
        arrows to reorder, or replace a photo to swap the picture and keep its place.
      </p>

      {!loading && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {photos.map((photo, index) => (
            <div key={photo.id} className="relative aspect-[3/4]  overflow-hidden group">
              <Image src={photo.photo_url} alt={photo.caption ?? ""} fill className="object-cover" />
              <div className="absolute top-1 left-1 right-1 flex justify-between gap-1">
                <label className="bg-black/80 text-paper text-xs px-1.5 py-0.5 font-bold uppercase cursor-pointer">
                  Replace
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={reordering === photo.id}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) handleReplace(photo.id, f);
                    }}
                  />
                </label>
                <button
                  onClick={() => handleDelete(photo.id)}
                  className="bg-black/80 text-paper text-xs px-1.5 py-0.5 font-bold uppercase"
                >
                  Remove
                </button>
              </div>
              {reordering === photo.id && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                  <div className="aa-spinner !w-8 !h-8" />
                </div>
              )}
              <div className="absolute bottom-1 left-1 right-1 flex justify-between">
                <button
                  onClick={() => move(index, -1)}
                  disabled={index === 0 || reordering === photo.id}
                  className="bg-black/80 text-paper text-xs w-6 h-6  disabled:opacity-30"
                  aria-label="Move earlier"
                >
                  ←
                </button>
                <button
                  onClick={() => move(index, 1)}
                  disabled={index === photos.length - 1 || reordering === photo.id}
                  className="bg-black/80 text-paper text-xs w-6 h-6  disabled:opacity-30"
                  aria-label="Move later"
                >
                  →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-danger font-bold">{error}</p>}
      {uploading && <p className="text-sm text-muted">Uploading...</p>}

      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={uploading || photos.length >= 8}
        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        className="text-xs"
      />
    </section>
  );
}

function DangerZone() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/account/delete", { method: "POST" });
    const data = await res.json();

    if (!res.ok) {
      setSubmitting(false);
      setError(data.error);
      return;
    }

    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <section className=" p-6 border border-danger/30 space-y-3">
      <h2 className="font-extrabold text-xl text-danger">Delete account</h2>
      <p className="text-sm text-muted">
        Your past bookings are kept for our records (same as if you&apos;d checked out as a
        guest) - only your account and sign-in are removed. This can&apos;t be undone.
      </p>
      {error && <p className="text-sm text-danger">{error}</p>}
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="px-4 py-2  border border-danger text-danger text-sm font-bold uppercase"
        >
          Delete my account
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <p className="text-sm">Are you sure?</p>
          <button
            onClick={handleDelete}
            disabled={submitting}
            className="px-4 py-2  bg-danger text-white text-sm font-bold uppercase disabled:opacity-50"
          >
            {submitting ? "Deleting..." : "Yes, delete it"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="text-sm font-bold uppercase text-muted"
          >
            Cancel
          </button>
        </div>
      )}
    </section>
  );
}
