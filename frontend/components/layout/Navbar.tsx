"use client";

import { LogOut, Menu, MessageSquare, PlusCircle, Shield, ShoppingBag, User as UserIcon } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

export function Navbar() {
  const { user, isLoading, logout } = useAuth();

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur-sm sm:px-6"
    >
      <Link href="/" className="text-sm font-semibold tracking-tight text-foreground">
        KenaBecha <span className="text-primary">JU</span>
      </Link>

      <div className="flex items-center gap-1 sm:gap-2">
        <ThemeToggle />

        {!isLoading &&
          (user ? (
            <>
              <NotificationBell />

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="ghost" size="icon" className="hidden rounded-full sm:inline-flex" />}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                    {user.full_name.charAt(0).toUpperCase()}
                  </span>
                  <span className="sr-only">Account menu</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="truncate">{user.full_name}</DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem render={<Link href={`/profile/${user.id}`} />}>
                    <UserIcon /> Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link href="/inbox" />}>
                    <MessageSquare /> Inbox
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link href="/shops/dashboard" />}>
                    <ShoppingBag /> My Shops
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link href="/listings/new" />}>
                    <PlusCircle /> New Listing
                  </DropdownMenuItem>
                  {user.role === "admin" && (
                    <DropdownMenuItem render={<Link href="/admin" />}>
                      <Shield /> Admin
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={logout}>
                    <LogOut /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Sheet>
                <SheetTrigger render={<Button variant="ghost" size="icon" className="sm:hidden" />}>
                  <Menu className="size-4.5" />
                  <span className="sr-only">Menu</span>
                </SheetTrigger>
                <SheetContent side="right">
                  <SheetHeader>
                    <SheetTitle className="truncate">{user.full_name}</SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col gap-1 px-4">
                    <SheetClose render={<Link href={`/profile/${user.id}`} className="flex items-center gap-2 rounded-md px-2 py-2.5 text-sm font-medium hover:bg-muted" />}>
                      <UserIcon className="size-4" />
                      Profile
                    </SheetClose>
                    <SheetClose render={<Link href="/inbox" className="flex items-center gap-2 rounded-md px-2 py-2.5 text-sm font-medium hover:bg-muted" />}>
                      <MessageSquare className="size-4" />
                      Inbox
                    </SheetClose>
                    <SheetClose render={<Link href="/shops/dashboard" className="flex items-center gap-2 rounded-md px-2 py-2.5 text-sm font-medium hover:bg-muted" />}>
                      <ShoppingBag className="size-4" />
                      My Shops
                    </SheetClose>
                    <SheetClose render={<Link href="/listings/new" className="flex items-center gap-2 rounded-md px-2 py-2.5 text-sm font-medium hover:bg-muted" />}>
                      <PlusCircle className="size-4" />
                      New Listing
                    </SheetClose>
                    {user.role === "admin" && (
                      <SheetClose render={<Link href="/admin" className="flex items-center gap-2 rounded-md px-2 py-2.5 text-sm font-medium hover:bg-muted" />}>
                        <Shield className="size-4" />
                        Admin
                      </SheetClose>
                    )}
                  </div>
                  <div className="mt-auto border-t border-border px-4 py-4">
                    <SheetClose render={<Button variant="outline" onClick={logout} className="w-full" />}>
                      Log out
                    </SheetClose>
                  </div>
                </SheetContent>
              </Sheet>
            </>
          ) : (
            <>
              <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                Log in
              </Link>
              <Link href="/signup" className={cn(buttonVariants({ size: "sm" }))}>
                Sign up
              </Link>
            </>
          ))}
      </div>
    </motion.header>
  );
}
