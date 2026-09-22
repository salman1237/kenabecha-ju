"use client";

import { Globe, LayoutDashboard, LogOut, Menu, MessageSquare, PlusCircle, Shield, ShoppingBag, User as UserIcon } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { NavbarSearch } from "@/components/layout/NavbarSearch";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { SmartImage } from "@/components/ui/SmartImage";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useNavigation } from "@/context/NavigationContext";
import { useUnreadMessageCount } from "@/hooks/useUnreadMessageCount";
import { NavIcon } from "@/components/layout/NavIcon";
import { menusAt, navLabel, visibleLinks } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** A single nav destination. Active links share one `layoutId`, so the pill
 *  behind them glides from the old destination to the new one on navigation
 *  instead of just popping — the one animation that makes a row of six
 *  links read as a single, considered control instead of loose text. */
function NavLink({
  href,
  active,
  badge,
  children,
}: {
  href: string;
  active: boolean;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative z-0 rounded-full px-3.5 py-1.5 transition-colors",
        active
          ? "text-emerald-700 dark:text-emerald-300"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {Boolean(badge) && (
        <span className="absolute -right-1 -top-1 z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-white">
          {badge! > 9 ? "9+" : badge}
        </span>
      )}
      {active && (
        <motion.span
          layoutId="navbar-active-pill"
          className="absolute inset-0 -z-10 rounded-full bg-background shadow-sm shadow-emerald-950/10 dark:shadow-black/20"
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
        />
      )}
      {children}
    </Link>
  );
}

export function Navbar() {
  const { user, isLoading, logout } = useAuth();
  const { locale, setLocale, t } = useLanguage();
  const navigation = useNavigation();
  const pathname = usePathname();
  const unreadMessages = useUnreadMessageCount();

  // The primary destinations are data — added, renamed, reordered, hidden and
  // scoped to signed-in or signed-out visitors from the admin panel. The
  // search box, bell, avatar menu and the two toggles are not links but
  // controls, so they stay in code; an admin can only switch them off.
  const [navbarMenu] = menusAt(navigation, "navbar");
  const primaryLinks = navbarMenu ? visibleLinks(navbarMenu, Boolean(user)) : [];
  const controls = navigation.navbar_controls;

  // Prefix match, except /shops must not light up on /shops/dashboard —
  // they are two different destinations sitting in the same nav.
  const isActive = (href: string) =>
    href === "/shops"
      ? pathname === "/shops" ||
        (pathname.startsWith("/shops/") && pathname !== "/shops/dashboard")
      : pathname === href || pathname.startsWith(href + "/");

  const toggleLanguage = () => {
    setLocale(locale === "en" ? "bn" : "en");
  };

  // A flat header reads the same at the top of the page and three screens
  // down, which is part of what made this row feel like plain browser
  // chrome. Tightening it and adding real elevation once the page has
  // scrolled gives the same six links and controls a sense of depth
  // without moving or hiding anything.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn(
        "sticky top-0 z-40 flex items-center justify-between gap-2 border-b bg-background/80 px-3 backdrop-blur-lg transition-[padding,box-shadow,border-color] duration-300 sm:px-6 lg:px-8",
        scrolled
          ? "border-border py-2 shadow-md shadow-emerald-950/5 dark:shadow-black/20"
          : "border-emerald-500/10 py-3.5 shadow-none"
      )}
    >
      <div className="flex min-w-0 items-center gap-3 lg:gap-4">
        <Link href="/" className="group flex min-w-0 shrink-0 items-center gap-2 text-lg font-bold tracking-tight">
          {navigation.site_info.logo_url ? (
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-xl shadow-md shadow-emerald-500/20 transition-transform group-hover:scale-105">
              <SmartImage src={navigation.site_info.logo_url} alt="" sizes="32px" />
            </div>
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              K
            </div>
          )}
          {/* nowrap + truncate: on the narrowest phones this row is genuinely
              tight against the controls on the right (language/theme toggle,
              notification bell, avatar, menu) — this is the graceful-shrink
              fallback so the wordmark ellipsizes instead of visually
              overlapping its neighbours when it can't fit. */}
          <span className="gradient-text hidden truncate whitespace-nowrap text-lg font-extrabold sm:inline sm:text-xl">
            KenaBecha JU
          </span>
        </Link>

        <div className="hidden h-6 w-px shrink-0 rounded-full bg-border lg:block" />

        {/* The primary destinations, not just Browse. These used to live only
            inside the avatar dropdown, which put the app's main actions two
            clicks deep and invisible until you knew to look. Sell, Inbox and
            My Shops appear only when signed in, since all three need an account.
            Grouped in one pill instead of loose text so six links read as a
            single control, with the active one riding a sliding highlight.
            A brand-tinted (not neutral-gray) fill: against a near-white page
            a plain muted/40 chip washed out to nothing — this is the one
            piece of chrome that should visibly read as "the app's nav",
            so it gets the emerald tint the rest of the utility controls
            deliberately don't. */}
        <nav className="hidden items-center gap-0.5 rounded-full border border-emerald-500/15 bg-emerald-500/8 p-1 text-sm font-medium dark:border-emerald-400/15 dark:bg-emerald-400/8 lg:flex">
          {primaryLinks.map((link) => (
            <NavLink
              key={link.id}
              href={link.href}
              active={isActive(link.href)}
              badge={link.href === "/inbox" ? unreadMessages : undefined}
            >
              {navLabel(link, locale, t)}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Search Bar */}
      {controls.search !== false && (
        <div className="flex-1 mx-4 max-w-2xl hidden md:flex justify-center">
          <NavbarSearch />
        </div>
      )}

      <div className="flex items-center gap-1.5 sm:gap-2.5">
        {/* Language + theme are pure convenience controls, not identity or
            content — grouped into one quiet pill so they read as a single
            utility cluster instead of two more buttons competing with the
            bell and avatar for attention. Neutral gray on purpose, so it
            reads as "settings" next to the branded emerald nav pill rather
            than competing with it. */}
        {(controls.language !== false || controls.theme !== false) && (
          <div className="flex items-center gap-0.5 rounded-full border border-border bg-muted p-1">
            {controls.language !== false && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleLanguage}
                // Text label only from `sm` up — on a phone this row is already
                // crowded (logo, theme toggle, bell, avatar, menu), and the label
                // is the one control here that's pure convenience, not identity.
                className="h-7 shrink-0 gap-1.5 rounded-full px-2 text-xs font-semibold hover:bg-background hover:text-emerald-600 dark:hover:text-emerald-400"
                title="Toggle Language"
              >
                <Globe className="size-3.5" />
                <span className="hidden sm:inline">{locale === "en" ? "বাংলা" : "EN"}</span>
              </Button>
            )}

            {/* Theme Toggle */}
            {controls.theme !== false && <ThemeToggle />}
          </div>
        )}

        {!isLoading &&
          (user ? (
            <>
              {controls.notifications !== false && <NotificationBell />}

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="ghost" size="icon" className="rounded-full ring-2 ring-emerald-500/20 hover:ring-emerald-500/40" />}
                >
                  <UserAvatar
                    name={user.full_name}
                    avatarUrl={user.avatar_url}
                    className="size-8 shadow-xs"
                    sizes="32px"
                  />
                  <span className="sr-only">{t.nav.accountMenu}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl border-emerald-500/15 p-1.5 shadow-xl">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="truncate px-2 py-1.5 font-semibold">{user.full_name}</DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator className="bg-emerald-500/10" />
                  <DropdownMenuItem render={<Link href="/dashboard" />}>
                    <LayoutDashboard className="size-4 text-emerald-600 dark:text-emerald-400" /> {t.nav.dashboard}
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link href={`/profile/${user.id}`} />}>
                    <UserIcon className="size-4 text-emerald-600 dark:text-emerald-400" /> {t.nav.profile}
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link href="/inbox" />}>
                    <MessageSquare className="size-4 text-emerald-600 dark:text-emerald-400" /> {t.nav.inbox}
                    {unreadMessages > 0 && (
                      <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-white">
                        {unreadMessages > 9 ? "9+" : unreadMessages}
                      </span>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link href="/shops/dashboard" />}>
                    <ShoppingBag className="size-4 text-emerald-600 dark:text-emerald-400" /> {t.nav.myShops}
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link href="/listings/new" />}>
                    <PlusCircle className="size-4 text-emerald-600 dark:text-emerald-400" /> {t.nav.sell}
                  </DropdownMenuItem>
                  {user.role === "admin" && (
                    <DropdownMenuItem render={<Link href="/admin" />}>
                      <Shield className="size-4 text-amber-500" /> {t.nav.admin}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="bg-emerald-500/10" />
                  <DropdownMenuItem variant="destructive" onClick={logout}>
                    <LogOut className="size-4" /> {t.nav.logout}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Sheet>
                <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" />}>
                  <Menu className="size-5" />
                  <span className="sr-only">{t.nav.menu}</span>
                </SheetTrigger>
                <SheetContent side="right" className="rounded-l-2xl border-l-emerald-500/20">
                  <SheetHeader>
                    <SheetTitle className="truncate text-emerald-600 dark:text-emerald-400">{user.full_name}</SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col gap-1.5 px-4 pt-4">
                    {/* The managed menu, then the account destinations —
                        which stay in code because they are bound to the
                        signed-in identity rather than being site links. */}
                    {primaryLinks.map((link) => (
                      <SheetClose key={link.id} render={<Link href={link.href} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium hover:bg-emerald-500/10" />}>
                        <NavIcon name={link.icon} className="size-4 text-emerald-600 dark:text-emerald-400" />
                        {navLabel(link, locale, t)}
                        {link.href === "/inbox" && unreadMessages > 0 && (
                          <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-white">
                            {unreadMessages > 9 ? "9+" : unreadMessages}
                          </span>
                        )}
                      </SheetClose>
                    ))}
                    <SheetClose render={<Link href="/dashboard" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium hover:bg-emerald-500/10" />}>
                      <LayoutDashboard className="size-4 text-emerald-600 dark:text-emerald-400" />
                      {t.nav.dashboard}
                    </SheetClose>
                    <SheetClose render={<Link href={`/profile/${user.id}`} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium hover:bg-emerald-500/10" />}>
                      <UserIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
                      {t.nav.profile}
                    </SheetClose>
                    {user.role === "admin" && (
                      <SheetClose render={<Link href="/admin" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium hover:bg-emerald-500/10" />}>
                        <Shield className="size-4 text-amber-500" />
                        {t.nav.admin}
                      </SheetClose>
                    )}
                  </div>
                  <div className="mt-auto border-t border-border px-4 py-4">
                    <SheetClose render={<Button variant="outline" onClick={logout} className="w-full rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10" />}>
                      {t.nav.logout}
                    </SheetClose>
                  </div>
                </SheetContent>
              </Sheet>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Sheet>
                <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" />}>
                  <Menu className="size-5" />
                  <span className="sr-only">{t.nav.menu}</span>
                </SheetTrigger>
                <SheetContent side="right" className="rounded-l-2xl border-l-emerald-500/20">
                  <SheetHeader>
                    <SheetTitle className="text-emerald-600 dark:text-emerald-400">
                      KenaBecha JU
                    </SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col gap-1.5 px-4 pt-4">
                    {primaryLinks.map((link) => (
                      <SheetClose key={link.id} render={<Link href={link.href} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium hover:bg-emerald-500/10" />}>
                        <NavIcon name={link.icon} className="size-4 text-emerald-600 dark:text-emerald-400" />
                        {navLabel(link, locale, t)}
                      </SheetClose>
                    ))}
                  </div>
                </SheetContent>
              </Sheet>
              <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "rounded-full hover:bg-emerald-500/10")}>
                {t.nav.login}
              </Link>
              <Link href="/signup" className={cn(buttonVariants({ size: "sm" }), "rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 shadow-md shadow-emerald-600/20 hover:from-emerald-500 hover:to-teal-500")}>
                {t.nav.signup}
              </Link>
            </div>
          ))}
      </div>
    </motion.header>
  );
}
