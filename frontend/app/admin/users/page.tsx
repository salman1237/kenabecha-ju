"use client";

import { useEffect, useState } from "react";

import { inputClass } from "@/components/ui/FormField";
import { listAdminUsers, setUserActive } from "@/lib/api/admin";
import type { AdminUser } from "@/types/api";

export default function AdminUsersPage() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    listAdminUsers(q)
      .then((page) => setUsers(page.items))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const onToggleActive = async (user: AdminUser) => {
    await setUserActive(user.id, !user.is_active);
    load();
  };

  return (
    <div className="flex flex-col gap-4">
      <input
        className={inputClass}
        placeholder="Search by name, email, or student ID…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800">
              <th className="py-2">Name</th>
              <th className="py-2">Email</th>
              <th className="py-2">Student ID</th>
              <th className="py-2">Role</th>
              <th className="py-2">Status</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2">{u.full_name}</td>
                <td className="py-2 text-zinc-500">{u.email}</td>
                <td className="py-2 text-zinc-500">{u.student_id}</td>
                <td className="py-2">{u.role}</td>
                <td className="py-2">
                  <span className={u.is_active ? "text-green-600" : "text-red-600"}>
                    {u.is_active ? "Active" : "Deactivated"}
                  </span>
                </td>
                <td className="py-2 text-right">
                  {u.role !== "admin" && (
                    <button
                      onClick={() => onToggleActive(u)}
                      className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                    >
                      {u.is_active ? "Deactivate" : "Reactivate"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
