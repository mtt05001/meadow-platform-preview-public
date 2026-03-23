"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { UserRole } from "@/lib/auth";
import Nav from "@/components/nav";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AppUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  imageUrl: string;
  lastSignInAt: number | null;
  createdAt: number;
}

const ROLE_BADGE: Record<UserRole, string> = {
  admin: "bg-[#e8f5e9] text-[#1a4d2e] border-[#c8e6c9]",
  facilitator: "bg-blue-50 text-blue-700 border-blue-200",
  client: "bg-gray-50 text-[#7f8c8d] border-[#e8e2d8]",
};

const ROLE_SELECT: Record<UserRole, string> = {
  admin: "text-[#1a4d2e] bg-[#e8f5e9] border-[#c8e6c9] focus:ring-[#2d7a4a]/30",
  facilitator: "text-blue-700 bg-blue-50 border-blue-200 focus:ring-blue-400/30",
  client: "text-[#7f8c8d] bg-gray-50 border-[#e8e2d8] focus:ring-[#2d7a4a]/30",
};

function formatDate(ts: number | null): string {
  if (!ts) return "\u2014";
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("facilitator");

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiFetch<AppUser[]>("/api/admin/users"),
  });

  const inviteMutation = useMutation({
    mutationFn: (params: { email: string; role: UserRole }) =>
      apiFetch("/api/admin/users", {
        method: "POST",
        body: params,
      }),
    onSuccess: () => {
      toast.success(`Invite sent to ${inviteEmail}`);
      setInviteEmail("");
      setInviteRole("client");
    },
    onError: (e) => toast.error("Invite failed: " + e.message),
  });

  const roleMutation = useMutation({
    mutationFn: (params: { userId: string; role: UserRole }) =>
      apiFetch(`/api/admin/users/${params.userId}/role`, {
        method: "PATCH",
        body: { role: params.role },
      }),
    onSuccess: () => {
      toast.success("Role updated");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => toast.error("Failed to update role: " + e.message),
  });

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    inviteMutation.mutate({ email: inviteEmail.trim(), role: inviteRole });
  }

  return (
    <div className="min-h-screen bg-[#f5f1eb]">
      <Nav subtitle="User Management" sticky />

      <main className="max-w-[960px] mx-auto px-6 md:px-8 py-8">
        {/* Page heading */}
        <h2 className="text-[24px] font-semibold text-[#1a4d2e] mb-6">
          Team &amp; Access
        </h2>

        {/* Invite bar */}
        <form
          onSubmit={handleInvite}
          className="
            flex items-center gap-3 mb-8
            bg-white rounded-lg border border-[#e8e2d8] px-4 py-3
          "
        >
          <div className="flex items-center gap-2 text-[13px] text-[#7f8c8d] shrink-0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[#7f8c8d]">
              <path d="M8 1.333A6.674 6.674 0 0 0 1.333 8 6.674 6.674 0 0 0 8 14.667 6.674 6.674 0 0 0 14.667 8 6.674 6.674 0 0 0 8 1.333Zm3.333 7.334H8.667v2.666H7.333V8.667H4.667V7.333h2.666V4.667h1.334v2.666h2.666v1.334Z" fill="currentColor"/>
            </svg>
            Invite
          </div>
          <input
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="email@example.com"
            className="
              flex-1 px-3 py-1.5 rounded-[6px] bg-[#f9f7f4] border border-[#e8e2d8]
              text-[13px] text-[#2c3e50]
              focus:outline-none focus:ring-2 focus:ring-[#2d7a4a]/30 focus:border-[#2d7a4a]
              placeholder:text-[#b0b8c0]
            "
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as UserRole)}
            className="
              px-3 py-1.5 rounded-[6px] bg-[#f9f7f4] border border-[#e8e2d8]
              text-[13px] text-[#2c3e50] cursor-pointer
              focus:outline-none focus:ring-2 focus:ring-[#2d7a4a]/30 focus:border-[#2d7a4a]
            "
          >
            <option value="admin">Admin</option>
            <option value="facilitator">Facilitator</option>
            <option value="client">Client</option>
          </select>
          <button
            type="submit"
            disabled={inviteMutation.isPending}
            className="
              px-4 py-1.5 rounded-[6px] text-[13px] font-semibold
              bg-[#1a4d2e] text-white
              hover:bg-[#2d7a4a] transition-all duration-150
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center gap-1.5
            "
          >
            {inviteMutation.isPending ? (
              <>
                <Spinner /> Sending...
              </>
            ) : (
              "Send Invite"
            )}
          </button>
        </form>

        {/* Users table */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-semibold text-[#2c3e50]">
            Users
          </h3>
          {users && (
            <span className="text-[13px] text-[#7f8c8d]">
              {users.length} member{users.length !== 1 && "s"}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-[#7f8c8d] text-[13px]">
            Loading users...
          </div>
        ) : !users?.length ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3 opacity-30">🌿</div>
            <p className="text-[13px] text-[#7f8c8d]">
              No users yet. Send an invite above to get started.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-[#e8e2d8] bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#f9f7f4] hover:bg-[#f9f7f4]">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[#5a6c7d]">
                    Name
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[#5a6c7d]">
                    Email
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[#5a6c7d]">
                    Role
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[#5a6c7d]">
                    Last Sign In
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[#5a6c7d]">
                    Joined
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow
                    key={user.id}
                    className="hover:bg-[#f5f1eb]/60 transition-colors"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        {user.imageUrl ? (
                          <img
                            src={user.imageUrl}
                            alt=""
                            className="w-7 h-7 rounded-full ring-1 ring-[#e8e2d8]"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-[#e8e2d8] flex items-center justify-center text-[11px] font-medium text-[#7f8c8d]">
                            {(user.firstName?.[0] ?? user.email[0]).toUpperCase()}
                          </div>
                        )}
                        <span className="text-[13px] font-medium text-[#2c3e50]">
                          {[user.firstName, user.lastName]
                            .filter(Boolean)
                            .join(" ") || "\u2014"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[12px] text-[#5a6c7d]">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      <select
                        value={user.role}
                        onChange={(e) =>
                          roleMutation.mutate({
                            userId: user.id,
                            role: e.target.value as UserRole,
                          })
                        }
                        disabled={roleMutation.isPending}
                        className={`
                          px-2 py-0.5 rounded-full text-[11px] font-semibold border
                          cursor-pointer appearance-none text-center
                          focus:outline-none focus:ring-2
                          disabled:opacity-50 disabled:cursor-not-allowed
                          transition-colors
                          ${ROLE_SELECT[user.role]}
                        `}
                      >
                        <option value="admin">Admin</option>
                        <option value="facilitator">Facilitator</option>
                        <option value="client">Client</option>
                      </select>
                    </TableCell>
                    <TableCell className="text-[12px] text-[#5a6c7d]">
                      {formatDate(user.lastSignInAt)}
                    </TableCell>
                    <TableCell className="text-[12px] text-[#5a6c7d]">
                      {formatDate(user.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="w-3.5 h-3.5 animate-spin"
      viewBox="0 0 16 16"
      fill="none"
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.3"
      />
      <path
        d="M14 8a6 6 0 0 0-6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
