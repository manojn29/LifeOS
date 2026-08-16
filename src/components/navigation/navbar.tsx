'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BookOpen, CheckSquare, MessageSquare, Sparkles, Settings, LogOut, User } from 'lucide-react';
import Image from 'next/image';
import { createClient } from '@/lib/db/supabase-browser';

const NAV_ITEMS = [
  { name: 'Journal', href: '/journal', icon: BookOpen },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
  { name: 'AI Chat', href: '/chat', icon: MessageSquare },
  { name: 'Digest', href: '/digest', icon: Sparkles },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setUserEmail(user.email);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <>
      {/* Desktop Header */}
      <header className="hidden md:flex items-center justify-between px-8 py-4 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-emerald-500/30">
            <Image src="/icons/icon-192.png" alt="LifeOS" fill sizes="32px" className="object-cover" />
          </div>
          <div>
            <span className="font-semibold tracking-tight text-zinc-100 text-lg">LifeOS</span>
            <span className="ml-2 text-xs font-mono text-emerald-400/90 px-1.5 py-0.5 rounded bg-emerald-950/50 border border-emerald-800/50">
              PWA
            </span>
          </div>
        </div>

        <nav className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800/80">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-zinc-800 text-emerald-400 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {userEmail ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-mono bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-800 max-w-[150px] truncate">
                {userEmail}
              </span>
              <button
                onClick={handleSignOut}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 cursor-pointer transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-xs font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-3 py-1.5 rounded-lg hover:bg-emerald-900/60 transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-nav px-4 py-2 flex items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-xs transition-colors ${
                isActive ? 'text-emerald-400 font-medium' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
