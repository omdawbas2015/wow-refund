'use client';

import { signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut, Globe, Moon, Sun, Search as SearchIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { NotificationsBell } from './notifications-bell';

interface TopBarProps {
  userName: string;
  userEmail: string;
  currentLocale: string;
}

export function TopBar({ userName, userEmail, currentLocale }: TopBarProps) {
  const t = useTranslations('nav');
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  function toggleLocale() {
    const next = currentLocale === 'en' ? 'ar' : 'en';
    // Swap locale prefix in the URL path
    let newPath = pathname;
    const prefixMatch = newPath.match(/^\/(en|ar)(\/|$)/);
    if (prefixMatch) {
      newPath = newPath.replace(/^\/(en|ar)/, `/${next}`);
    } else {
      newPath = `/${next}${newPath === '/' ? '' : newPath}`;
    }
    router.push(newPath);
    router.refresh();
  }

  // Open the global command palette. The palette listens for Ctrl/Cmd+K
  // on document — re-dispatching the event keeps a single source of truth.
  function openSearch() {
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
    );
  }

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-surface px-4">
      <button
        type="button"
        onClick={openSearch}
        className="hidden h-9 min-w-[260px] flex-1 max-w-md items-center gap-2 rounded-md border border-border bg-surface-subtle px-3 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground sm:flex"
        aria-label={t('search')}
      >
        <SearchIcon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-start">{t('search')}</span>
        <kbd className="hidden rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground md:inline-block">
          ⌘K
        </kbd>
      </button>
      <div className="ms-auto hidden text-sm text-muted-foreground md:block">
        <span className="font-medium text-foreground">{userName}</span>
        <span className="mx-2">·</span>
        <span>{userEmail}</span>
      </div>
      <div className="flex items-center gap-2">
        <NotificationsBell locale={currentLocale} />
        <Button variant="ghost" size="sm" onClick={toggleLocale} aria-label="Toggle language">
          <Globe className="h-4 w-4" />
          <span className="ms-1 uppercase">{currentLocale === 'en' ? 'AR' : 'EN'}</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="h-4 w-4" />
          <span className="ms-1 hidden sm:inline">{t('logout')}</span>
        </Button>
      </div>
    </header>
  );
}
