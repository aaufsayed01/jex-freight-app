import AppShell from "@/components/layout/AppShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      items={[
        { href: "/admin", label: "Admin Home" },
        { href: "/admin/quotes", label: "Quotes" },
        { href: "/admin/pricing", label: "Pricing" },
        { href: "/admin/quotes/new", label: "New Quote" },
      ]}
    >
      {children}
    </AppShell>
  );
}
