import Topbar from "./Topbar";
import Sidebar from "./Sidebar";

type Item = { href: string; label: string };

export default function AppShell({
  items,
  children,
}: {
  items: Item[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Topbar />
      <div className="flex">
        <Sidebar items={items} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
