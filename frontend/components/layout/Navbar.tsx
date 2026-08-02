"use client";

import Link from "next/link";
import { motion } from "motion/react";

import { CartLink } from "@/components/cart/CartLink";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
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

      <div className="flex items-center gap-2">
        <ThemeToggle />

        {!isLoading &&
          (user ? (
            <>
              <Link href="/orders" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                Orders
              </Link>
              <CartLink />
              <NotificationBell />
              <Button variant="ghost" size="sm" onClick={logout}>
                Log out
              </Button>
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
