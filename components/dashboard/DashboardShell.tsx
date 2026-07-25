"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Command,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  DashboardFiltersProvider,
  type DateRangeDays,
  useDashboardFilters,
} from "@/components/dashboard/DashboardFilters";
import {
  DASHBOARD_NAVIGATION,
  dashboardPageTitle,
  navigationForRole,
  type DashboardNavItem,
} from "@/components/dashboard/navigation";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import type { AdminIdentity } from "@/features/auth/contracts";

export function DashboardShell({
  identity,
  children,
}: {
  identity: AdminIdentity;
  children: ReactNode;
}) {
  return (
    <DashboardFiltersProvider>
      <DashboardShellContent identity={identity}>
        {children}
      </DashboardShellContent>
    </DashboardFiltersProvider>
  );
}

function DashboardShellContent({
  identity,
  children,
}: {
  identity: AdminIdentity;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const availableItems = useMemo(
    () => navigationForRole(identity.role),
    [identity.role],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (event.key === "/" && !typing) {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setMobileOpen(false);
        setNotificationsOpen(false);
        setProfileOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen || searchOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen, searchOpen]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-transparent text-foreground">
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r transition-[width] duration-200 lg:flex ${
          collapsed ? "w-[72px]" : "w-64"
        }`}
        style={{ background: "var(--gradient-sidebar)" }}
        aria-label="Primary navigation"
      >
        <SidebarContents
          collapsed={collapsed}
          identity={identity}
          pathname={pathname}
          onNavigate={() => undefined}
        />
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="absolute -right-3 top-[68px] z-10 grid size-7 place-items-center rounded-full border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight aria-hidden="true" className="size-3.5" />
          ) : (
            <ChevronLeft aria-hidden="true" className="size-3.5" />
          )}
        </button>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-overlay/55"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="relative flex h-full w-[min(84vw,320px)] flex-col border-r shadow-2xl"
            style={{ background: "var(--gradient-sidebar)" }}
            aria-label="Mobile navigation"
          >
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 grid size-11 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
              aria-label="Close navigation"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
            <SidebarContents
              collapsed={false}
              identity={identity}
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <header className="gradient-header sticky top-0 z-40 flex h-16 items-center border-b px-3 backdrop-blur sm:px-5 lg:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="mr-1 grid size-11 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary lg:hidden"
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
          >
            <Menu aria-hidden="true" className="size-5" />
          </button>

          <div className="min-w-0">
            <p className="hidden text-[11px] text-muted-foreground sm:block">
              Qoondeeye / Analytics
            </p>
            <p className="truncate text-sm font-semibold">
              {dashboardPageTitle(pathname)}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            <DateRangeControl />

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden min-h-10 w-48 items-center gap-2 rounded-md border bg-card px-3 text-left text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary xl:flex"
              aria-label="Search dashboard"
            >
              <Search aria-hidden="true" className="size-4" />
              <span>Search dashboard</span>
              <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                /
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="grid size-11 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary xl:hidden"
              aria-label="Search dashboard"
            >
              <Search aria-hidden="true" className="size-[18px]" />
            </button>

            <ThemeToggle />

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen((value) => !value);
                  setProfileOpen(false);
                }}
                className="relative grid size-11 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                aria-label="Notifications, 1 unread"
                aria-expanded={notificationsOpen}
              >
                <Bell aria-hidden="true" className="size-[18px]" />
                <span className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-destructive ring-2 ring-background" />
              </button>
              {notificationsOpen ? <NotificationsPopover /> : null}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileOpen((value) => !value);
                  setNotificationsOpen(false);
                }}
                className="ml-0.5 flex min-h-11 items-center gap-2 rounded-md px-1.5 text-left transition-colors hover:bg-primary/10 sm:px-2"
                aria-label="Open admin profile menu"
                aria-expanded={profileOpen}
              >
                <Avatar email={identity.email} />
                <div className="hidden max-w-32 leading-tight md:block">
                  <p className="truncate text-xs font-medium">
                    {identity.email.split("@")[0]}
                  </p>
                  <p className="text-[10px] capitalize text-muted-foreground">
                    {identity.role}
                  </p>
                </div>
                <ChevronDown
                  aria-hidden="true"
                  className="hidden size-3.5 text-muted-foreground md:block"
                />
              </button>
              {profileOpen ? (
                <ProfilePopover identity={identity} onLogout={handleLogout} />
              ) : null}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8">
          {children}
        </main>
      </div>

      {searchOpen ? (
        <CommandMenu
          items={availableItems}
          onClose={() => setSearchOpen(false)}
          onSelect={(href) => {
            setSearchOpen(false);
            router.push(href);
          }}
        />
      ) : null}
    </div>
  );
}

function SidebarContents({
  collapsed,
  identity,
  pathname,
  onNavigate,
}: {
  collapsed: boolean;
  identity: AdminIdentity;
  pathname: string;
  onNavigate: () => void;
}) {
  const visibleHrefs = new Set(
    navigationForRole(identity.role).map((item) => item.href),
  );

  return (
    <>
      <div
        className={`flex h-16 items-center border-b ${collapsed ? "justify-center px-2" : "px-4"}`}
      >
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex min-h-11 min-w-11 items-center gap-2.5 rounded-md"
          aria-label="Qoondeeye Admin overview"
        >
          <span className="brand-gradient grid size-8 shrink-0 place-items-center rounded-md text-sm font-bold text-primary-foreground">
            Q
          </span>
          {!collapsed ? (
            <span className="leading-tight">
              <span className="block text-sm font-semibold tracking-tight">
                Qoondeeye
              </span>
              <span className="block text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Admin
              </span>
            </span>
          ) : null}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {DASHBOARD_NAVIGATION.map((group) => {
          const visibleItems = group.items.filter((item) =>
            visibleHrefs.has(item.href),
          );
          if (visibleItems.length === 0) return null;
          return (
            <div className="mb-5" key={group.label}>
              {!collapsed ? (
                <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {group.label}
                </p>
              ) : (
                <div className="mx-auto mb-2 h-px w-7 bg-border" />
              )}
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/dashboard" &&
                      pathname.startsWith(`${item.href}/`));
                  const Icon = item.icon;
                  return (
                    <Link
                      aria-current={active ? "page" : undefined}
                      aria-label={collapsed ? item.label : undefined}
                      className={`group relative flex min-h-10 items-center rounded-md text-sm transition-all ${
                        collapsed ? "justify-center px-2" : "gap-3 px-2.5"
                      } ${
                        active
                          ? "gradient-button text-primary-foreground"
                          : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      }`}
                      href={item.href}
                      key={item.href}
                      onClick={onNavigate}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon
                        aria-hidden="true"
                        className="size-[17px] shrink-0"
                        strokeWidth={1.8}
                      />
                      {!collapsed ? (
                        <span className="truncate">{item.label}</span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t p-2">
        <a
          className={`flex min-h-10 items-center rounded-md text-sm text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary ${
            collapsed ? "justify-center px-2" : "gap-3 px-2.5"
          }`}
          href="mailto:support@qoondeeye.com"
          title={collapsed ? "Help center" : undefined}
        >
          <CircleHelp aria-hidden="true" className="size-[17px]" />
          {!collapsed ? <span>Help center</span> : null}
        </a>
      </div>
    </>
  );
}

function DateRangeControl() {
  const { days, isCustomRange, setDays } = useDashboardFilters();
  return (
    <label className="relative hidden sm:block">
      <span className="sr-only">Global date range</span>
      <CalendarDays
        aria-hidden="true"
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <select
        value={isCustomRange ? "custom" : days}
        onChange={(event) => {
          if (event.target.value !== "custom") {
            setDays(Number(event.target.value) as DateRangeDays);
          }
        }}
        className="min-h-10 appearance-none rounded-md border bg-card pl-8 pr-8 text-xs font-medium text-foreground outline-none transition-colors hover:border-primary/30 hover:bg-primary/10"
      >
        <option value={7}>Last 7 days</option>
        <option value={30}>Last 30 days</option>
        <option value={90}>Last 90 days</option>
        {isCustomRange ? <option value="custom">Custom range</option> : null}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
      />
    </label>
  );
}

function NotificationsPopover() {
  return (
    <div
      className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-1rem))] rounded-lg border bg-popover p-2 text-popover-foreground"
      style={{ boxShadow: "var(--shadow-dialog)" }}
    >
      <div className="flex items-center justify-between px-2 py-2">
        <p className="text-sm font-semibold">Notifications</p>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
          1 new
        </span>
      </div>
      <div className="rounded-md bg-muted/60 p-3">
        <div className="flex gap-3">
          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border bg-card">
            <Activity aria-hidden="true" className="size-3.5" />
          </span>
          <div>
            <p className="text-xs font-medium">Telemetry coverage incomplete</p>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
              Sync and OCR health will populate after mobile instrumentation is
              connected.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfilePopover({
  identity,
  onLogout,
}: {
  identity: AdminIdentity;
  onLogout: () => void;
}) {
  return (
    <div
      className="absolute right-0 top-12 z-50 w-64 rounded-lg border bg-popover p-2 text-popover-foreground"
      style={{ boxShadow: "var(--shadow-dialog)" }}
    >
      <div className="flex items-center gap-3 border-b p-2 pb-3">
        <Avatar email={identity.email} />
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">{identity.email}</p>
          <p className="mt-0.5 text-[10px] capitalize text-muted-foreground">
            {identity.role} access
          </p>
        </div>
      </div>
      <div className="p-1 pt-2">
        <Link
          href="/dashboard/settings"
          className="flex min-h-10 items-center gap-2 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <Settings aria-hidden="true" className="size-4" />
          Account settings
        </Link>
        <button
          type="button"
          onClick={onLogout}
          className="flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <ShieldCheck aria-hidden="true" className="size-4" />
          Secure log out
        </button>
      </div>
    </div>
  );
}

function Avatar({ email }: { email: string }) {
  const initials = email.slice(0, 2).toUpperCase();
  return (
    <span
      className="brand-gradient grid size-8 shrink-0 place-items-center rounded-md text-[10px] font-semibold text-primary-foreground"
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

function CommandMenu({
  items,
  onClose,
  onSelect,
}: {
  items: DashboardNavItem[];
  onClose: () => void;
  onSelect: (href: string) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = items.filter((item) =>
    item.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-3 pt-[12vh] sm:pt-[16vh]">
      <button
        type="button"
        className="absolute inset-0 bg-overlay/55"
        onClick={onClose}
        aria-label="Close search"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search dashboard"
        className="relative w-full max-w-xl overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b px-4">
          <Search aria-hidden="true" className="size-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-14 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Search pages and tools…"
            aria-label="Search pages and tools"
          />
          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length ? (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  type="button"
                  key={item.href}
                  onClick={() => onSelect(item.href)}
                  className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  <Icon aria-hidden="true" className="size-4" />
                  <span>{item.label}</span>
                  <Command
                    aria-hidden="true"
                    className="ml-auto size-3.5 opacity-40"
                  />
                </button>
              );
            })
          ) : (
            <p className="px-3 py-10 text-center text-xs text-muted-foreground">
              No matching dashboard pages.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
