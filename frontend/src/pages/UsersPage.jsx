import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import api from "../api/client";
import { useToast } from "../context/ToastContext";
import StatusPill from "../components/StatusPill";
import BackButton from "../components/BackButton";

function rolesToLabel(roles = []) {
  return roles.map((r) => r.name).join(", ");
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [filters, setFilters] = useState({ q: "", roleId: "", isActive: "" });
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState([]);
  const [mobileMenuUserId, setMobileMenuUserId] = useState(null);
  const [sortBy, setSortBy] = useState("fullName");
  const [sortDir, setSortDir] = useState("ASC");
  const limit = 10;

  const { register, handleSubmit, reset } = useForm({
    defaultValues: { fullName: "", email: "", password: "", roleIds: [] }
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => (await api.get("/roles")).data
  });

  const { data: usersPaged } = useQuery({
    queryKey: ["users-admin", filters, page, sortBy, sortDir],
    queryFn: async () => (
      await api.get("/users", {
        params: {
          ...filters,
          paged: true,
          page,
          limit,
          sortBy,
          sortDir
        }
      })
    ).data
  });

  const users = usersPaged?.rows || [];
  const totalPages = usersPaged?.totalPages || 1;
  const totalUsers = usersPaged?.total || 0;

  const createUser = useMutation({
    mutationFn: async (payload) => (await api.post("/users", payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-admin"] });
      showToast("User created", "success");
      reset();
    },
    onError: (error) => showToast(error?.response?.data?.message || "Failed to create user", "error", 3000)
  });

  const updateUser = useMutation({
    mutationFn: async ({ userId, payload }) => (await api.patch(`/users/${userId}`, payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-admin"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      showToast("User updated", "success");
    },
    onError: (error) => showToast(error?.response?.data?.message || "Failed to update user", "error", 3000)
  });

  const resetPassword = useMutation({
    mutationFn: async ({ userId, newPassword }) =>
      (await api.patch(`/users/${userId}/reset-password`, { newPassword })).data,
    onSuccess: () => showToast("Password reset successfully", "success"),
    onError: (error) => showToast(error?.response?.data?.message || "Failed to reset password", "error", 3000)
  });

  const sortedRoleOptions = useMemo(() => [...roles].sort((a, b) => a.name.localeCompare(b.name)), [roles]);
  const activeCount = useMemo(() => users.filter((u) => u.isActive).length, [users]);
  const inactiveCount = useMemo(() => users.filter((u) => !u.isActive).length, [users]);

  const onCreate = (values) => {
    const roleIds = Array.isArray(values.roleIds) ? values.roleIds.map(Number) : [];
    createUser.mutate({
      fullName: values.fullName,
      email: values.email,
      password: values.password,
      roleIds
    });
  };

  const openRoleEditor = (user) => {
    setSelectedUser(user);
    setSelectedRoleIds((user.Roles || []).map((r) => r.id));
    setMobileMenuUserId(null);
  };

  const applyRoleUpdate = () => {
    if (!selectedUser) return;
    updateUser.mutate({ userId: selectedUser.id, payload: { roleIds: selectedRoleIds } });
    setSelectedUser(null);
  };

  const onSort = (field) => {
    setPage(1);
    if (sortBy === field) setSortDir((prev) => (prev === "ASC" ? "DESC" : "ASC"));
    else {
      setSortBy(field);
      setSortDir("ASC");
    }
  };

  const sortArrow = (field) => (sortBy === field ? (sortDir === "ASC" ? " ▲" : " ▼") : "");

  const onInlineUpdate = (user, field, value) => {
    const nextValue = String(value || "").trim();
    const currentValue = String(user[field] || "").trim();
    if (!nextValue || nextValue === currentValue) return;
    updateUser.mutate({ userId: user.id, payload: { [field]: nextValue } });
  };

  const onResetPassword = (user) => {
    const newPassword = window.prompt(`Enter new password for ${user.fullName} (min 6 chars):`);
    setMobileMenuUserId(null);
    if (newPassword === null) return;
    if (String(newPassword).length < 6) {
      showToast("Password must be at least 6 characters", "error");
      return;
    }
    resetPassword.mutate({ userId: user.id, newPassword });
  };

  return (
    <div className="space-y-6">
      <BackButton />
      <div className="bg-white rounded-xl shadow p-5 card-premium card-entrance">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-2xl font-semibold">User Management</h2>
            <p className="text-sm text-slate-500 mt-1">Manage users, access roles, and account activation controls.</p>
          </div>
          <StatusPill value="Admin Console" type="ids-status" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-slate-50 border rounded-xl p-3">
            <div className="text-xs text-slate-500">Total Users</div>
            <div className="text-xl font-semibold">{totalUsers}</div>
          </div>
          <div className="bg-slate-50 border rounded-xl p-3">
            <div className="text-xs text-slate-500">Active on page</div>
            <div className="text-xl font-semibold">{activeCount}</div>
          </div>
          <div className="bg-slate-50 border rounded-xl p-3">
            <div className="text-xs text-slate-500">Inactive on page</div>
            <div className="text-xl font-semibold">{inactiveCount}</div>
          </div>
          <div className="bg-slate-50 border rounded-xl p-3">
            <div className="text-xs text-slate-500">Roles Available</div>
            <div className="text-xl font-semibold">{roles.length}</div>
          </div>
        </div>
        <form className="grid md:grid-cols-4 gap-2" onSubmit={handleSubmit(onCreate)}>
          <input className="border rounded px-3 py-2" placeholder="Full name" {...register("fullName", { required: true })} />
          <input className="border rounded px-3 py-2" placeholder="Email" type="email" {...register("email", { required: true })} />
          <input className="border rounded px-3 py-2" placeholder="Password (min 6 chars)" type="password" {...register("password", { required: true, minLength: 6 })} />
          <select className="border rounded px-3 py-2" multiple {...register("roleIds", { required: true })}>
            {sortedRoleOptions.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
          </select>
          <button type="submit" className="md:col-span-4 bg-indigo-600 text-white rounded px-3 py-2 font-medium" disabled={createUser.isPending}>
            {createUser.isPending ? "Creating..." : "Create User"}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow p-6 card-premium card-entrance">
        <div className="grid md:grid-cols-3 gap-2 mb-3">
          <input
            className="border rounded px-3 py-2"
            placeholder="Search name/email"
            value={filters.q}
            onChange={(e) => {
              setPage(1);
              setFilters((prev) => ({ ...prev, q: e.target.value }));
            }}
          />
          <select
            className="border rounded px-3 py-2"
            value={filters.roleId}
            onChange={(e) => {
              setPage(1);
              setFilters((prev) => ({ ...prev, roleId: e.target.value }));
            }}
          >
            <option value="">All roles</option>
            {sortedRoleOptions.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
          </select>
          <select
            className="border rounded px-3 py-2"
            value={filters.isActive}
            onChange={(e) => {
              setPage(1);
              setFilters((prev) => ({ ...prev, isActive: e.target.value }));
            }}
          >
            <option value="">All status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>

        <div className="overflow-auto max-h-[28rem] rounded-lg border">
          <table className="w-full text-left users-table">
            <thead className="bg-slate-100 sticky top-0 z-10">
              <tr>
                <th className="p-2 cursor-pointer select-none" onClick={() => onSort("fullName")}>Name{sortArrow("fullName")}</th>
                <th className="p-2 cursor-pointer select-none" onClick={() => onSort("email")}>Email{sortArrow("email")}</th>
                <th className="p-2">Roles</th>
                <th className="p-2 cursor-pointer select-none" onClick={() => onSort("isActive")}>Status{sortArrow("isActive")}</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t hover:bg-slate-50/70 transition-colors users-row">
                  <td className="p-2">
                    <input
                      className="border rounded px-2 py-1 w-full users-row-input"
                      defaultValue={user.fullName}
                      onBlur={(e) => onInlineUpdate(user, "fullName", e.target.value)}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      className="border rounded px-2 py-1 w-full users-row-input"
                      type="email"
                      defaultValue={user.email}
                      onBlur={(e) => onInlineUpdate(user, "email", e.target.value)}
                    />
                  </td>
                  <td className="p-2 text-sm">{rolesToLabel(user.Roles)}</td>
                  <td className="p-2">
                    <StatusPill value={user.isActive ? "Active" : "Inactive"} type={user.isActive ? "task" : "ids-severity"} />
                  </td>
                  <td className="p-2">
                    <div className="hidden md:flex gap-2">
                      <button type="button" className="border rounded px-2 py-1 text-sm" onClick={() => openRoleEditor(user)}>Roles</button>
                      <button
                        type="button"
                        className={`border rounded px-2 py-1 text-sm ${user.isActive ? "text-amber-700" : "text-green-700"}`}
                        onClick={() => updateUser.mutate({ userId: user.id, payload: { isActive: !user.isActive } })}
                      >
                        {user.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        className="border rounded px-2 py-1 text-sm text-indigo-700"
                        onClick={() => onResetPassword(user)}
                        disabled={resetPassword.isPending}
                      >
                        Reset Password
                      </button>
                    </div>
                    <div className="md:hidden users-actions-menu">
                      <button
                        type="button"
                        className="border rounded px-2 py-1 text-sm inline-flex cursor-pointer"
                        onClick={() => setMobileMenuUserId((prev) => (prev === user.id ? null : user.id))}
                      >
                        ...
                      </button>
                      {mobileMenuUserId === user.id && (
                        <div className="mt-1 flex flex-col gap-1 bg-white border rounded p-2 shadow min-w-[9rem]">
                          <button type="button" className="border rounded px-2 py-1 text-sm text-left" onClick={() => openRoleEditor(user)}>Roles</button>
                        <button
                          type="button"
                          className={`border rounded px-2 py-1 text-sm text-left ${user.isActive ? "text-amber-700" : "text-green-700"}`}
                          onClick={() => {
                            updateUser.mutate({ userId: user.id, payload: { isActive: !user.isActive } });
                            setMobileMenuUserId(null);
                          }}
                        >
                          {user.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          className="border rounded px-2 py-1 text-sm text-left text-indigo-700"
                          onClick={() => onResetPassword(user)}
                          disabled={resetPassword.isPending}
                        >
                          Reset Password
                        </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!users.length && (
                <tr><td className="p-3 text-slate-500 text-sm" colSpan={5}>No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
          <div>Page {page} of {totalPages}</div>
          <div className="flex gap-2">
            <button type="button" className="border rounded px-3 py-1" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Previous</button>
            <button type="button" className="border rounded px-3 py-1" disabled={page >= totalPages} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}>Next</button>
          </div>
        </div>
      </div>

      {selectedUser && (
        <div className="bg-white rounded-xl shadow p-6 card-premium card-entrance">
          <h3 className="text-lg font-semibold mb-3">Update Roles: {selectedUser.fullName}</h3>
          <div className="grid md:grid-cols-3 gap-2">
            {sortedRoleOptions.map((role) => (
              <label key={role.id} className="border rounded px-3 py-2 text-sm flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedRoleIds.includes(role.id)}
                  onChange={(e) => setSelectedRoleIds((prev) => e.target.checked ? [...prev, role.id] : prev.filter((id) => id !== role.id))}
                />
                {role.name}
              </label>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" className="bg-indigo-600 text-white rounded px-3 py-2" onClick={applyRoleUpdate} disabled={updateUser.isPending}>Save Roles</button>
            <button type="button" className="border rounded px-3 py-2" onClick={() => setSelectedUser(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
