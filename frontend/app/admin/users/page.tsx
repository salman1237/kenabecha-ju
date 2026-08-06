"use client";

import { useEffect, useState } from "react";

import { DataTable, type Column } from "@/components/admin/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/useDebounce";
import { listAdminUsers, setUserActive, setUserRole } from "@/lib/api/admin";
import { translateApiError } from "@/lib/i18n/errors";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { selectClass } from "@/components/ui/FormField";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { AdminUser, UserRole } from "@/types/api";

export default function AdminUsersPage() {
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 250);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { user: currentUser } = useAuth();
  const { t } = useLanguage();

  const load = (query: string) => {
    setLoading(true);
    listAdminUsers(query)
      .then((page) => setUsers(page.items))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(debouncedQ);
  }, [debouncedQ]);

  // The API enforces the rules (no self-change, no demoting the last admin)
  // and returns 400 with a readable message. Surfacing that verbatim beats
  // duplicating the logic here, where it could drift out of step.
  const run = async (user: AdminUser, action: () => Promise<unknown>) => {
    setBusyId(user.id);
    try {
      await action();
      load(debouncedQ);
    } catch (err) {
      toast.error(translateApiError(err, t));
    } finally {
      setBusyId(null);
    }
  };

  const onToggleActive = (user: AdminUser) =>
    run(user, () => setUserActive(user.id, !user.is_active));

  const onChangeRole = (user: AdminUser, role: UserRole) => {
    if (role === user.role) return;
    return run(user, async () => {
      await setUserRole(user.id, role);
      toast.success(`${user.full_name} is now ${role}`);
    });
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
      cell: (u) => (
        <Badge
          variant={u.role === "admin" ? "default" : u.role === "moderator" ? "secondary" : "outline"}
          className="capitalize"
        >
          {u.role}
        </Badge>
      ),
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
        actions={(u) => {
          // Your own row offers nothing: the API refuses a self role change or
          // self-deactivation, so showing the controls would only produce a
          // 400. Saying why is more useful than a disabled button.
          if (u.id === currentUser?.id) {
            return <span className="text-xs text-muted-foreground">You</span>;
          }
          return (
            <div className="flex items-center gap-2">
              <select
                value={u.role}
                disabled={busyId === u.id}
                onChange={(e) => onChangeRole(u, e.target.value as UserRole)}
                aria-label={`Role for ${u.full_name}`}
                className={cn(selectClass, "h-8 w-32 text-xs")}
              >
                <option value="user">User</option>
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
              </select>
              <Button
                variant="ghost"
                size="sm"
                disabled={busyId === u.id}
                onClick={() => onToggleActive(u)}
              >
                {u.is_active ? "Deactivate" : "Reactivate"}
              </Button>
            </div>
          );
        }}
      />
    </div>
  );
}
