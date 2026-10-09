/**
 * Roles that can have a public Cast & Crew profile. Admins and organizers
 * can be listed too, so staff can be credited on productions with one login.
 */
export const MEMBER_ROLES = ["actor", "admin", "organizer"] as const;
export const STAFF_ROLES = ["admin", "organizer"] as const;
