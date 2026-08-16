import { Navbar } from '@/components/navigation/navbar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      <Navbar />
      <main className="flex-1 w-full">{children}</main>
    </div>
  );
}
