import AppShell from "@/components/layout/AppShell";

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      items={[
        { href: "/staff", label: "Staff Home" },
        { href: "/staff/quotes", label: "Quotes (Ops)" },
      ]}
    >
      {children}
    </AppShell>
  );
}
