import { HealthStatus } from "./health-status";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">KenaBecha JU</h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        Buy, sell, and run shops within the Jahangirnagar University community.
      </p>
      <HealthStatus />
    </div>
  );
}
