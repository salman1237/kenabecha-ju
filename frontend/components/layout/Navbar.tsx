"use client";

import { Menu, Package, ShoppingBag } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

import { CartLink } from "@/components/cart/CartLink";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

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
              <Link href="/orders" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}>
                Orders
              </Link>
              <CartLink />
              <NotificationBell />
              <Button variant="ghost" size="sm" onClick={logout} className="hidden sm:inline-flex">
                Log out
              </Button>

              <Sheet>
                <SheetTrigger render={<Button variant="ghost" size="icon" className="sm:hidden" />}>
                  <Menu className="size-4.5" />
                  <span className="sr-only">Menu</span>
                </SheetTrigger>
                <SheetContent side="right">
                  <SheetHeader>
                    <SheetTitle>Menu</SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col gap-1 px-4">
                    <SheetClose render={<Link href="/orders" className="flex items-center gap-2 rounded-md px-2 py-2.5 text-sm font-medium hover:bg-muted" />}>
                      <Package className="size-4" />
                      Orders
                    </SheetClose>
                    <SheetClose render={<Link href="/shops/dashboard" className="flex items-center gap-2 rounded-md px-2 py-2.5 text-sm font-medium hover:bg-muted" />}>
                      <ShoppingBag className="size-4" />
                      My Shops
                    </SheetClose>
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
