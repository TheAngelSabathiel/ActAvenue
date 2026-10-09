import { NextRequest, NextResponse } from "next/server";
import { MEMBER_ROLES } from "@/lib/member-roles";
import { createServiceClient } from "@/lib/supabase/service";
import { requireStaff } from "@/lib/admin-auth";
import { sendActorTakenDownEmail } from "@/lib/email/send";

/**
 * Takes an actor profile's public listing down. Only clears is_approved -
 * deliberately does NOT touch is_public (the actor's own stated intent),
 * so if they never asked to be listed there's nothing to "reject" here in
 * the first place, and if an admin later re-approves, the actor doesn't
 * have to re-opt-in.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { id } = await params;
  const db = createServiceClient();
  const { data, error } = await db
    .from("profiles")
    .update({ is_approved: false })
    .eq("id", id)
    .in("role", [...MEMBER_ROLES])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Same reasoning as the approve route: the takedown is already
  // committed, an email failure shouldn't fail the request.
  try {
    const { data: authUser } = await db.auth.admin.getUserById(id);
    if (authUser.user?.email) {
      await sendActorTakenDownEmail(authUser.user.email, data.display_name);
    }
  } catch (err) {
    console.error(`Failed to send actor-taken-down email for ${id}:`, err);
  }

  return NextResponse.json({ profile: data });
}
