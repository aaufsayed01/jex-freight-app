"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string };

export default function Sidebar({ items }: { items: Item[] }) {
  const pathname = usePathname();

  return (
    <aside className="w-60 border-r min-h-[calc(100vh-56px)] p-3 bg-white">
      <nav className="space-y-1">
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`block rounded-xl px-3 py-2 text-sm ${
                active ? "bg-gray-100 font-medium" : "hover:bg-gray-50"
              }`}
            >
              {it.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
