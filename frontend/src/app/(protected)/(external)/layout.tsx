import AppShell from "@/components/layout/AppShell";

export default function ExternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      items={[
        { href: "/dashboard", label: "Dashboard" },
        { href: "/quotes", label: "Quotes" },
      ]}
    >
      {children}
    </AppShell>
  );
}
