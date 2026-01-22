"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { homeRouteForRole } from "@/lib/roleRoutes";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) {
      router.replace("/auth/login");
      return;
    }

    // Block wrong role routes:
    if (pathname.startsWith("/admin") && user.role !== "ADMIN") router.replace("/unauthorized");
    if (pathname.startsWith("/staff") && user.role !== "INTERNAL_STAFF" && user.role !== "ADMIN")
      router.replace("/unauthorized");
    if (pathname.startsWith("/dashboard") && !(user.role === "CORPORATE_CLIENT" || user.role === "AGENT"))
      router.replace(homeRouteForRole(user.role));
  }, [user, pathname, router]);

  if (!user) return null;
  return <>{children}</>;
}
