"use client";

import { useAuth } from "@/context/AuthContext";
import { HealthStatus } from "./health-status";

export default function Home() {
  const { user, isLoading } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">KenaBecha JU</h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        Buy, sell, and run shops within the Jahangirnagar University community.
      </p>
      <HealthStatus />

      <div className="flex gap-3">
        <a
          href="/listings"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Browse listings
        </a>
        {user && (
          <>
            <a
              href="/listings/new"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Sell something
            </a>
            <a
              href="/shops/dashboard"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              My Shops
            </a>
            <a
              href="/inbox"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Inbox
            </a>
            {user.role === "admin" && (
              <a
                href="/admin"
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Admin
              </a>
            )}
          </>
        )}
      </div>

      {!isLoading && user && (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          Logged in as <span className="font-medium">{user.full_name}</span> ({user.department.name}, batch{" "}
          {user.batch})
        </p>
      )}
    </div>
  );
}
