"use client";

import { useEffect, useState } from "react";

import { DataTable, type Column } from "@/components/admin/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/useDebounce";
import { listAdminUsers, setUserActive } from "@/lib/api/admin";
import type { AdminUser } from "@/types/api";

export default function AdminUsersPage() {
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 250);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = (query: string) => {
    setLoading(true);
    listAdminUsers(query)
      .then((page) => setUsers(page.items))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(debouncedQ);
  }, [debouncedQ]);

  const onToggleActive = async (user: AdminUser) => {
    await setUserActive(user.id, !user.is_active);
    load(debouncedQ);
  };

  const columns: Column<AdminUser>[] = [
    {
      key: "full_name",
      header: "Name",
      cell: (u) => <span className="font-medium">{u.full_name}</span>,
      sortValue: (u) => u.full_name,
    },
    {
      key: "email",
      header: "Email",
      cell: (u) => <span className="text-muted-foreground">{u.email}</span>,
      sortValue: (u) => u.email,
    },
    {
      key: "student_id",
      header: "Student ID",
      cell: (u) => <span className="text-muted-foreground">{u.student_id ?? "— (Google)"}</span>,
      sortValue: (u) => u.student_id ?? "",
      hideOnMobile: true,
    },
    {
      key: "role",
      header: "Role",
      cell: (u) => <span className="capitalize">{u.role}</span>,
      sortValue: (u) => u.role,
    },
    {
      key: "is_active",
      header: "Status",
      cell: (u) => (
        <Badge variant={u.is_active ? "secondary" : "destructive"}>
          {u.is_active ? "Active" : "Deactivated"}
        </Badge>
      ),
      sortValue: (u) => (u.is_active ? "Active" : "Deactivated"),
    },
    {
      key: "created_at",
      header: "Joined",
      cell: (u) => (
        <span className="text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</span>
      ),
      sortValue: (u) => u.created_at,
      hideOnMobile: true,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold tracking-tight">Users</h1>
      <DataTable
        rows={users}
        columns={columns}
        loading={loading}
        // Server-side search — the endpoint filters across the whole table
        // by name/email/student ID, not just the rows already loaded.
        searchValue={q}
        onSearchChange={setQ}
        searchPlaceholder="Search by name, email, or student ID…"
        exportName="users"
        emptyTitle="No users found"
        emptyDescription={q ? "Try a different search term." : undefined}
        actions={(u) =>
          u.role !== "admin" ? (
            <Button variant="ghost" size="sm" onClick={() => onToggleActive(u)}>
              {u.is_active ? "Deactivate" : "Reactivate"}
            </Button>
          ) : null
        }
      />
    </div>
  );
}
