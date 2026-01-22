"use client";

import { useAuthStore } from "@/store/auth.store";

export default function Topbar() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="h-14 border-b flex items-center justify-between px-4 bg-white">
      <div className="font-semibold">JEX Freight</div>
      <div className="text-sm text-gray-600">
        {user?.fullName ?? user?.email} ({user?.role})
      </div>
    </div>
  );
}
