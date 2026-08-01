"use client";

import { useEffect, useState } from "react";

type Status = "checking" | "ok" | "error";

export function HealthStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    fetch(`${apiUrl}/health`)
      .then((res) => (res.ok ? setStatus("ok") : setStatus("error")))
      .catch(() => setStatus("error"));
  }, []);

  const label = {
    checking: "Checking backend connection…",
    ok: "Backend connected",
    error: "Backend unreachable",
  }[status];

  const dotColor = {
    checking: "bg-zinc-400",
    ok: "bg-green-500",
    error: "bg-red-500",
  }[status];

  return (
    <div className="flex items-center gap-2 text-sm text-zinc-500">
      <span className={`h-2 w-2 rounded-full ${dotColor}`} />
      {label}
    </div>
  );
}
