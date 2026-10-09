import { NextRequest, NextResponse } from "next/server";
import { MEMBER_ROLES } from "@/lib/member-roles";
import { createServiceClient } from "@/lib/supabase/service";
import { requireStaff } from "@/lib/admin-auth";
import { sendActorApprovedEmail } from "@/lib/email/send";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { id } = await params;
  const db = createServiceClient();
  const { data, error } = await db
    .from("profiles")
    .update({ is_approved: true })
    .eq("id", id)
    .in("role", [...MEMBER_ROLES])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // The approval itself is already committed at this point - an email
  // failure (bad API key, Resend outage, or just not finding the auth
  // user) shouldn't fail the approval. Best-effort notification only.
  try {
    const { data: authUser } = await db.auth.admin.getUserById(id);
    if (authUser.user?.email) {
      await sendActorApprovedEmail(authUser.user.email, data.display_name);
    }
  } catch (err) {
    console.error(`Failed to send actor-approved email for ${id}:`, err);
  }

  return NextResponse.json({ profile: data });
}
