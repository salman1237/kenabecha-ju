"use client";

import { Globe, LayoutDashboard, LogOut, Menu, MessageSquare, PlusCircle, Shield, ShoppingBag, User as UserIcon } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
import { NavIcon } from "@/components/layout/NavIcon";
import { menusAt, navLabel, visibleLinks } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** A single nav destination, with its own active state. */
function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-lg px-3 py-1.5 transition-colors",
        active
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "text-muted-foreground hover:bg-emerald-500/5 hover:text-emerald-600 dark:hover:text-emerald-400"
      )}
    >
      {children}
    </Link>
  );
}

export function Navbar() {
  const { user, isLoading, logout } = useAuth();
  const { locale, setLocale, t } = useLanguage();
  const navigation = useNavigation();
  const pathname = usePathname();

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

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-emerald-500/10 bg-background/75 px-3 py-3 shadow-xs backdrop-blur-md sm:px-6 lg:px-8"
    >
      <div className="flex min-w-0 items-center gap-4 lg:gap-6">
        <Link href="/" className="group flex items-center gap-2 text-lg font-bold tracking-tight">
          {navigation.site_info.logo_url ? (
            <div className="h-8 w-8 overflow-hidden rounded-xl shadow-md shadow-emerald-500/20 transition-transform group-hover:scale-105">
              <SmartImage src={navigation.site_info.logo_url} alt="" sizes="32px" />
            </div>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              K
            </div>
          )}
          {/* nowrap: at 390px the wordmark otherwise breaks after "KenaBecha"
              and doubles the header height. */}
          <span className="gradient-text whitespace-nowrap text-lg font-extrabold sm:text-xl">
            KenaBecha JU
          </span>
        </Link>

        {/* The primary destinations, not just Browse. These used to live only
            inside the avatar dropdown, which put the app's main actions two
            clicks deep and invisible until you knew to look. Sell, Inbox and
            My Shops appear only when signed in, since all three need an account. */}
        <nav className="hidden items-center gap-1 text-sm font-medium lg:flex">
          {primaryLinks.map((link) => (
            <NavLink key={link.id} href={link.href} active={isActive(link.href)}>
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

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Language Switcher */}
        {controls.language !== false && (
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleLanguage}
          className="h-8 gap-1.5 rounded-full px-2.5 text-xs font-semibold hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400"
          title="Toggle Language"
        >
          <Globe className="size-3.5" />
          <span>{locale === "en" ? "বাংলা" : "EN"}</span>
        </Button>
        )}

        {/* Theme Toggle */}
        {controls.theme !== false && <ThemeToggle />}

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
