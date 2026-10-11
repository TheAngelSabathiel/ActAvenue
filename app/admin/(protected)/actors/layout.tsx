import { requireAdminPage } from "@/lib/admin-auth";

export default async function AdminOnlyLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return children;
}
