import { Link, NavLink, Outlet } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ModeToggle } from '@/components/ui/mode-toggle';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard' },
  { to: '/services', label: 'Services' },
  { to: '/analysis', label: 'Analysis' },
];

export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="text-lg font-semibold">
            Cloudflare Logging
          </Link>
          <nav className="flex items-center gap-4">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'text-sm font-medium transition-colors hover:text-foreground/80',
                    isActive ? 'text-foreground' : 'text-foreground/60',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            <ModeToggle />
            <Button asChild variant="outline">
              <a href="https://developers.cloudflare.com/workers/" target="_blank" rel="noreferrer">
                Docs
              </a>
            </Button>
          </nav>
        </div>
      </header>
      <main className="container flex-1 py-6">
        <Outlet />
      </main>
      <footer className="border-t bg-muted/30 py-4">
        <div className="container text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Cloudflare Logging Service
        </div>
      </footer>
    </div>
  );
}
