"use client";

import Link from "next/link";

import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useAuth } from "@/context/AuthContext";

export function Navbar() {
  const { user, isLoading, logout } = useAuth();

  return (
    <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
      <Link href="/" className="text-sm font-semibold tracking-tight">
        KenaBecha JU
      </Link>

      {!isLoading && (
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <NotificationBell />
              <button
                onClick={logout}
                className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
