"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  KeyRound,
  Pencil,
  Plus,
  Search,
  Shield,
  UserMinus,
  Users,
  Upload,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormModal, FormField, FormActions } from "@/components/ui/form-modal";
import { getRoleLabel, MODULES } from "@/lib/permissions";
import type { UserRole } from "@/generated/prisma/client";

type Tab = "users" | "roles";

type RoleInfo = {
  role: UserRole;
  label: string;
  description: string;
  permissions: Array<{
    module: string;
    canCreate: boolean;
    canRead: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canApprove: boolean;
    canExport: boolean;
  }>;
};

type UserRow = {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  status: string;
  lastLogin?: string | null;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function StatusPill({ status }: { status: string }) {
  const active = status === "ACTIVE";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        active ? "bg-[#E8F2E0] text-[#105820]" : "bg-slate-100 text-slate-500"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function RolePill({ role }: { role: UserRole }) {
  const isSuper = role === "SUPER_ADMIN";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        isSuper
          ? "bg-[#105820] text-white"
          : "bg-[#F3F8F0] text-[#105820] ring-1 ring-[#d5e8c8]"
      }`}
    >
      {getRoleLabel(role)}
    </span>
  );
}

export default function AccountManagementPage() {
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [assignableRoles, setAssignableRoles] = useState<UserRole[]>([]);
  const [canEditPermissions, setCanEditPermissions] = useState(false);
  const [canCreateUsers, setCanCreateUsers] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [createForm, setCreateForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    role: "SALES_OFFICER" as UserRole,
    status: "ACTIVE",
  });
  const [editForm, setEditForm] = useState({
    id: "",
    fullName: "",
    phone: "",
    role: "SALES_OFFICER" as UserRole,
    status: "ACTIVE",
  });
  const [resetForm, setResetForm] = useState({ id: "", name: "", password: "Admin@123" });

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 4000);
  };

  const loadUsers = useCallback(() => {
    setLoadError("");
    fetch("/api/users")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          const list = (res.data.users || res.data || []) as UserRow[];
          setUsers(list);
          const nextRoles = (res.data.assignableRoles || []) as UserRole[];
          setAssignableRoles(nextRoles);
          setCanEditPermissions(Boolean(res.data.canEditPermissions));
          setCanCreateUsers(Boolean(res.data.canCreateUsers));
          if (nextRoles.length > 0) {
            setCreateForm((prev) =>
              nextRoles.includes(prev.role) ? prev : { ...prev, role: nextRoles[0] }
            );
          }
        } else {
          setLoadError(res.message || "Failed to load users");
        }
      })
      .catch(() => setLoadError("Network error loading users"));
  }, []);

  const loadRoles = useCallback(() => {
    fetch("/api/roles")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setRoles(res.data.roles || []);
      });
  }, []);

  useEffect(() => {
    loadUsers();
    loadRoles();
  }, [loadUsers, loadRoles]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        getRoleLabel(u.role).toLowerCase().includes(q)
    );
  }, [users, query]);

  const stats = useMemo(() => {
    const active = users.filter((u) => u.status === "ACTIVE").length;
    const admins = users.filter((u) =>
      ["SUPER_ADMIN", "ADMIN"].includes(u.role)
    ).length;
    return {
      total: users.length,
      active,
      inactive: users.length - active,
      admins,
      roles: roles.length,
    };
  }, [users, roles]);

  const handleCreate = async (close: () => void) => {
    setLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      }).then((r) => r.json());
      if (res.success) {
        setCreateForm({
          fullName: "",
          email: "",
          phone: "",
          role: assignableRoles[0] || "SALES_OFFICER",
          status: "ACTIVE",
        });
        loadUsers();
        close();
        setShowCreate(false);
        flash(res.message || "Invite sent — user can set their password.");
      } else {
        flash(res.message || "Failed to create user");
      }
    } catch {
      flash("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (close: () => void) => {
    setLoading(true);
    const res = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    }).then((r) => r.json());
    setLoading(false);
    if (res.success) {
      loadUsers();
      close();
      setShowEdit(false);
      flash("User updated");
    } else flash(res.message);
  };

  const handleReset = async (close: () => void) => {
    setLoading(true);
    const res = await fetch(`/api/users/${resetForm.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset-password", password: resetForm.password }),
    }).then((r) => r.json());
    setLoading(false);
    if (res.success) {
      flash(res.message || "Password reset");
      close();
      setShowReset(false);
    } else flash(res.message);
  };

  const deactivateUser = async (id: string, name: string) => {
    if (!confirm(`Deactivate ${name}? They will no longer be able to sign in.`)) return;
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" }).then((r) => r.json());
    if (res.success) {
      loadUsers();
      flash("User deactivated");
    } else flash(res.message);
  };

  const togglePermission = async (
    role: UserRole,
    module: string,
    field: string,
    value: boolean
  ) => {
    if (!canEditPermissions) return;
    setLoading(true);
    const res = await fetch("/api/roles", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, module, [field]: value }),
    }).then((r) => r.json());
    setLoading(false);
    if (res.success) loadRoles();
    else flash(res.message);
  };

  const openEdit = (user: UserRow) => {
    setEditForm({
      id: user.id,
      fullName: user.fullName,
      phone: user.phone || "",
      role: user.role,
      status: user.status,
    });
    setShowEdit(true);
  };

  const openReset = (user: UserRow) => {
    setResetForm({ id: user.id, name: user.fullName, password: "Admin@123" });
    setShowReset(true);
  };

  return (
    <div className="dash-page space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium tracking-wide text-[#5A6B5E]">Administration</p>
          <h1 className="dash-title mt-1 text-3xl font-semibold tracking-tight text-[#0F1F12]">
            Account management
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-slate-500">
            Manage team access, roles, and module permissions for One Source.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/settings" className="dash-btn-secondary inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Settings
          </Link>
          <Link href="/import?type=users" className="dash-btn-secondary inline-flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Bulk import
          </Link>
          {tab === "users" && canCreateUsers && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="dash-btn-primary inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add user
            </button>
          )}
        </div>
      </header>

      {(loadError || notice) && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            loadError
              ? "border-red-100 bg-red-50 text-red-700"
              : "border-[#d5e8c8] bg-[#E8F2E0] text-[#105820]"
          }`}
        >
          {loadError || notice}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total users", value: stats.total, icon: Users },
          { label: "Active", value: stats.active, icon: Shield },
          { label: "Admins", value: stats.admins, icon: KeyRound },
          { label: "Roles", value: stats.roles, icon: Shield },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className="dash-card flex items-center gap-4 p-4">
              <span className="rounded-xl bg-[#E8F2E0] p-2.5 text-[#105820]">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                  {item.label}
                </p>
                <p className="mt-0.5 text-2xl font-semibold tabular-nums text-[#0F1F12]">
                  {item.value}
                </p>
              </div>
            </article>
          );
        })}
      </section>

      <div className="dash-card p-1.5">
        <div className="flex gap-1">
          {(
            [
              { id: "users" as const, label: "Users", icon: Users },
              { id: "roles" as const, label: "Roles & permissions", icon: Shield },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition sm:flex-none ${
                  active
                    ? "bg-[#105820] text-white shadow-sm"
                    : "text-slate-500 hover:bg-[#F3F8F0] hover:text-[#105820]"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "users" && (
        <section className="dash-card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-[#e8f2e0] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="dash-title text-lg font-semibold text-[#0F1F12]">Team members</h2>
              <p className="text-sm text-slate-400">
                {filteredUsers.length} of {users.length} shown
              </p>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email, role…"
                className="w-full rounded-xl border border-[#d5e8c8] bg-[#F3F8F0] py-2.5 pr-3 pl-9 text-sm text-[#0F1F12] outline-none placeholder:text-slate-400 focus:border-[#78B028] focus:bg-white"
              />
            </div>
          </div>

          {!canCreateUsers && !loadError && (
            <p className="border-b border-[#e8f2e0] bg-[#F3F8F0] px-5 py-3 text-sm text-slate-600">
              Only Super Admin or Admin can add new users.
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[#e8f2e0] text-left text-[11px] font-semibold tracking-[0.12em] text-slate-400 uppercase">
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Last login</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-[#f0f6eb] transition hover:bg-[#F3F8F0]/60"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#105820] text-xs font-bold text-white">
                            {initials(user.fullName)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[#0F1F12]">
                              {user.fullName}
                            </p>
                            <p className="truncate text-xs text-slate-400">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <RolePill role={user.role} />
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusPill status={user.status} />
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {user.lastLogin
                          ? new Date(user.lastLogin).toLocaleDateString("en-UG", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "Never"}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(user)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#d5e8c8] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#105820] hover:bg-[#F3F8F0]"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => openReset(user)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#d5e8c8] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#105820] hover:bg-[#F3F8F0]"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            Reset
                          </button>
                          {user.status === "ACTIVE" && user.role !== "SUPER_ADMIN" && (
                            <button
                              type="button"
                              onClick={() => deactivateUser(user.id, user.fullName)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                            >
                              <UserMinus className="h-3.5 w-3.5" />
                              Deactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "roles" && (
        <section className="space-y-4">
          {!canEditPermissions && (
            <p className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Permission editing is restricted to Super Admin. You can view role access below.
            </p>
          )}

          {roles.map((role) => (
            <article key={role.role} className="dash-card overflow-hidden">
              <div className="flex flex-col gap-2 border-b border-[#e8f2e0] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="dash-title text-lg font-semibold text-[#0F1F12]">
                      {role.label}
                    </h2>
                    <RolePill role={role.role} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{role.description}</p>
                </div>
              </div>

              <div className="px-5 py-4">
                {role.role === "SUPER_ADMIN" ? (
                  <p className="rounded-xl bg-[#E8F2E0] px-4 py-3 text-sm font-medium text-[#105820]">
                    Full access to all modules — permissions are fixed for Super Admin.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[#e8f2e0]">
                    <table className="w-full min-w-[640px] text-xs">
                      <thead>
                        <tr className="bg-[#F3F8F0] text-left text-[11px] font-semibold tracking-[0.1em] text-slate-400 uppercase">
                          <th className="px-3 py-2.5">Module</th>
                          <th className="px-3 py-2.5 text-center">Read</th>
                          <th className="px-3 py-2.5 text-center">Create</th>
                          <th className="px-3 py-2.5 text-center">Update</th>
                          <th className="px-3 py-2.5 text-center">Delete</th>
                          <th className="px-3 py-2.5 text-center">Approve</th>
                          <th className="px-3 py-2.5 text-center">Export</th>
                        </tr>
                      </thead>
                      <tbody>
                        {MODULES.map((mod) => {
                          const perm = role.permissions.find((p) => p.module === mod) || {
                            canRead: false,
                            canCreate: false,
                            canUpdate: false,
                            canDelete: false,
                            canApprove: false,
                            canExport: false,
                          };
                          return (
                            <tr key={mod} className="border-t border-[#e8f2e0]">
                              <td className="px-3 py-2 font-medium capitalize text-[#0F1F12]">
                                {mod.replace(/_/g, " ")}
                              </td>
                              {(
                                [
                                  "canRead",
                                  "canCreate",
                                  "canUpdate",
                                  "canDelete",
                                  "canApprove",
                                  "canExport",
                                ] as const
                              ).map((field) => (
                                <td key={field} className="px-3 py-2 text-center">
                                  {canEditPermissions ? (
                                    <input
                                      type="checkbox"
                                      checked={perm[field]}
                                      onChange={(e) =>
                                        togglePermission(
                                          role.role,
                                          mod,
                                          field,
                                          e.target.checked
                                        )
                                      }
                                      className="h-3.5 w-3.5 rounded border-slate-300"
                                      style={{ accentColor: "#78B028" }}
                                      disabled={loading}
                                    />
                                  ) : perm[field] ? (
                                    <span className="font-semibold text-[#78B028]">✓</span>
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </article>
          ))}
        </section>
      )}

      {showCreate && (
        <FormModal title="Add user" open onOpenChange={setShowCreate}>
          {({ close }) => (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreate(close);
              }}
              className="space-y-3"
            >
              <FormField label="Full name">
                <Input
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                  required
                />
              </FormField>
              <FormField label="Email">
                <Input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  required
                />
              </FormField>
              <FormField label="Phone">
                <Input
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                />
              </FormField>
              <p className="rounded-xl bg-[#F3F8F0] px-3 py-2.5 text-xs text-slate-600">
                The user will receive an email with a link to set their password (valid for 48
                hours). Use a real email address.
              </p>
              <FormField label="Role">
                <Select
                  value={createForm.role}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, role: e.target.value as UserRole })
                  }
                >
                  {assignableRoles.map((r) => (
                    <option key={r} value={r}>
                      {getRoleLabel(r)}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormActions onCancel={close} loading={loading} submitLabel="Create & send invite" />
            </form>
          )}
        </FormModal>
      )}

      {showEdit && (
        <FormModal title="Edit user" open onOpenChange={setShowEdit}>
          {({ close }) => (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleEdit(close);
              }}
              className="space-y-3"
            >
              <FormField label="Full name">
                <Input
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  required
                />
              </FormField>
              <FormField label="Phone">
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </FormField>
              <FormField label="Role">
                <Select
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm({ ...editForm, role: e.target.value as UserRole })
                  }
                >
                  {assignableRoles.map((r) => (
                    <option key={r} value={r}>
                      {getRoleLabel(r)}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Status">
                <Select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </Select>
              </FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      {showReset && (
        <FormModal title={`Reset password — ${resetForm.name}`} open onOpenChange={setShowReset}>
          {({ close }) => (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleReset(close);
              }}
              className="space-y-3"
            >
              <FormField label="New password">
                <Input
                  type="password"
                  value={resetForm.password}
                  onChange={(e) => setResetForm({ ...resetForm, password: e.target.value })}
                  required
                />
              </FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}
    </div>
  );
}
