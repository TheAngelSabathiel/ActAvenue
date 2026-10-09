"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";

export default function ReuploadPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const res = await fetch(`/api/reservation/${params.code}/reupload`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      setSubmitting(false);
      return;
    }

    router.push(`/reservation/${params.code}`);
  }

  return (
    <div className="aa-container max-w-xl py-12">
      <div className="aa-card p-8 space-y-6">
        <h1 className="text-2xl mb-0">Re-upload Payment Proof</h1>
        <p className="mb-0">
          Reference code <span className="font-bold">{params.code}</span>. Upload a clearer copy of your payment proof. This reopens your booking for review.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4" encType="multipart/form-data">
          <input type="file" name="payment_proof" accept="image/*,application/pdf" required className="aa-input" />
          {error && <p className="text-sm text-danger font-bold mb-0">{error}</p>}
          <button type="submit" disabled={submitting} className="aa-btn aa-btn-lg w-full">
            {submitting ? "Uploading..." : "Submit for Review"}
          </button>
        </form>
      </div>
    </div>
  );
}
