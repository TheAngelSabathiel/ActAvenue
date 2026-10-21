"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/** Scanner accounts only use the scan screen. Anything else sends them back to it. */
export function ScannerGuard({ scannerOnly }: { scannerOnly: boolean }) {
  const path = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (scannerOnly && !path.startsWith("/admin/scan")) router.replace("/admin/scan");
  }, [scannerOnly, path, router]);
  return null;
}
