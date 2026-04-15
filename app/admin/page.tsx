"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { UserRole } from "@/lib/auth";
import type { AiFeedback } from "@/lib/types";
import Nav from "@/components/nav";
import { toast } from "sonner";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

type FeedbackRow = AiFeedback & { client_name: string };

const ROLE_SELECT: Record<UserRole, string> = {
  admin: "text-[#1a4d2e] bg-[#e8f5e9] border-[#c8e6c9] focus:ring-[#2d7a4a]/30",
  facilitator: "text-blue-700 bg-blue-50 border-blue-200 focus:ring-blue-400/30",
  client: "text-[#7f8c8d] bg-gray-50 border-[#e8e2d8] focus:ring-[#2d7a4a]/30",
};

function formatDate(ts: number | string | null): string {
  if (!ts) return "\u2014";
  const d = typeof ts === "number" ? new Date(ts) : new Date(ts);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-[#f5f1eb]">
      <Nav subtitle="Admin" sticky />

      <main className="max-w-[960px] mx-auto px-6 md:px-8 py-8">
        <Card className="mb-8 border-[#1a4d2e]/15 bg-white/90 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-[#1a4d2e]">Facilitator capacity</CardTitle>
            <CardDescription>
              Sales routing and journey load across facilitators (GHL + saved weekly caps).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/capacity"
              className="inline-flex text-sm font-semibold text-[#2d7a4a] underline-offset-2 hover:underline"
            >
              Open capacity dashboard →
            </Link>
          </CardContent>
        </Card>

        <Tabs defaultValue="team">
          <TabsList variant="line" className="mb-8">
            <TabsTrigger value="team" className="text-[14px] px-4">
              Team &amp; Access
            </TabsTrigger>
            <TabsTrigger value="ai" className="text-[14px] px-4">
              AI Configuration
            </TabsTrigger>
          </TabsList>

          <TabsContent value="team">
            <TeamAccessTab />
          </TabsContent>
          <TabsContent value="ai">
            <AiConfigTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

/* ─── Team & Access Tab ─── */
function TeamAccessTab() {
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
    <>
      <h2 className="text-[24px] font-semibold text-[#1a4d2e] mb-6">
        Team &amp; Access
      </h2>

      {/* Invite bar */}
      <Card className="mb-8">
        <CardContent>
          <form onSubmit={handleInvite} className="flex items-center gap-3">
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
        </CardContent>
      </Card>

      {/* Users table */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-semibold text-[#2c3e50]">Users</h3>
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
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-[13px] text-[#7f8c8d]">
              No users yet. Send an invite above to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#f9f7f4] hover:bg-[#f9f7f4]">
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-[#5a6c7d]">Name</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-[#5a6c7d]">Email</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-[#5a6c7d]">Role</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-[#5a6c7d]">Last Sign In</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-[#5a6c7d]">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} className="hover:bg-[#f5f1eb]/60 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      {user.imageUrl ? (
                        <img src={user.imageUrl} alt="" className="w-7 h-7 rounded-full ring-1 ring-[#e8e2d8]" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[#e8e2d8] flex items-center justify-center text-xs font-medium text-[#7f8c8d]">
                          {(user.firstName?.[0] ?? user.email[0]).toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm font-medium text-[#2c3e50]">
                        {[user.firstName, user.lastName].filter(Boolean).join(" ") || "\u2014"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-[#5a6c7d]">{user.email}</TableCell>
                  <TableCell>
                    <select
                      value={user.role}
                      onChange={(e) =>
                        roleMutation.mutate({ userId: user.id, role: e.target.value as UserRole })
                      }
                      disabled={roleMutation.isPending}
                      className={`
                        px-2 py-0.5 rounded-full text-xs font-semibold border
                        cursor-pointer appearance-none text-center
                        focus:outline-none focus:ring-2
                        disabled:opacity-50 disabled:cursor-not-allowed
                        transition-colors ${ROLE_SELECT[user.role]}
                      `}
                    >
                      <option value="admin">Admin</option>
                      <option value="facilitator">Facilitator</option>
                      <option value="client">Client</option>
                    </select>
                  </TableCell>
                  <TableCell className="text-sm text-[#5a6c7d]">{formatDate(user.lastSignInAt)}</TableCell>
                  <TableCell className="text-sm text-[#5a6c7d]">{formatDate(user.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}

/* ─── AI Configuration Tab ─── */
function AiConfigTab() {
  const [promptExpanded, setPromptExpanded] = useState(false);

  const { data: promptData, isLoading: promptLoading } = useQuery({
    queryKey: ["admin-ai-prompt"],
    queryFn: () =>
      apiFetch<{ prompt: string; static_email_footer: string }>("/api/admin/ai-prompt"),
  });

  const { data: feedback, isLoading: feedbackLoading } = useQuery({
    queryKey: ["admin-ai-feedback"],
    queryFn: () => apiFetch<FeedbackRow[]>("/api/admin/ai-feedback"),
  });

  return (
    <div className="space-y-10">
      {/* AI Prompt Section */}
      <section>
        <h2 className="text-[24px] font-semibold text-[#1a4d2e] mb-1">
          AI Prompt
        </h2>
        <p className="text-[13px] text-[#7f8c8d] mb-4">
          The prompt used to generate medication guidance emails and risk stratifications. Read-only.
        </p>

        {promptLoading ? (
          <div className="text-center py-8 text-[#7f8c8d] text-[13px]">
            Loading prompt...
          </div>
        ) : promptData ? (
          <Card>
            <CardHeader
              className="cursor-pointer select-none"
              onClick={() => setPromptExpanded(!promptExpanded)}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-[14px]">System Prompt</CardTitle>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className={`text-[#7f8c8d] transition-transform ${promptExpanded ? "rotate-180" : ""}`}
                >
                  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </CardHeader>
            {promptExpanded && (
              <CardContent className="space-y-6 border-t border-[#e8e2d8] pt-4">
                <pre className="text-[12px] leading-relaxed text-[#2c3e50] whitespace-pre-wrap font-mono bg-[#f9f7f4] rounded-lg p-4 max-h-[500px] overflow-y-auto">
                  {promptData.prompt}
                </pre>
                <div>
                  <p className="text-[11px] font-semibold text-[#5a6c7d] mb-2 uppercase tracking-wide">
                    Static Email Footer (appended to every email)
                  </p>
                  <pre className="text-[12px] leading-relaxed text-[#2c3e50] whitespace-pre-wrap font-mono bg-[#f9f7f4] rounded-lg p-4 max-h-[300px] overflow-y-auto">
                    {promptData.static_email_footer}
                  </pre>
                </div>
              </CardContent>
            )}
          </Card>
        ) : null}
      </section>

      {/* Feedback Log Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[24px] font-semibold text-[#1a4d2e] mb-1">
              Feedback Log
            </h2>
            <p className="text-[13px] text-[#7f8c8d]">
              Reviewer feedback on AI-generated outputs.
            </p>
          </div>
          {feedback && feedback.length > 0 && (
            <Badge variant="secondary" className="text-[12px]">
              {feedback.length} entr{feedback.length === 1 ? "y" : "ies"}
            </Badge>
          )}
        </div>

        {feedbackLoading ? (
          <div className="text-center py-16 text-[#7f8c8d] text-[13px]">
            Loading feedback...
          </div>
        ) : !feedback?.length ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-[13px] text-[#7f8c8d]">
                No feedback submitted yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {feedback.map((row) => (
              <Card key={row.id} size="sm">
                <CardContent>
                  <div className="flex items-start gap-3">
                    <Badge
                      variant="outline"
                      className={`shrink-0 mt-0.5 text-[11px] ${
                        row.feedback_type === "medication_guidance"
                          ? "border-blue-200 text-blue-700 bg-blue-50"
                          : "border-amber-200 text-amber-700 bg-amber-50"
                      }`}
                    >
                      {row.feedback_type === "medication_guidance"
                        ? "Email"
                        : row.feedback_type === "risk_stratification"
                          ? "Risk Strat"
                          : row.feedback_type}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[#2c3e50] leading-relaxed">
                        {row.feedback_text}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-[12px] text-[#7f8c8d]">
                        <span className="font-medium">{row.client_name}</span>
                        <span>&middot;</span>
                        <span>{row.reviewer}</span>
                        <span>&middot;</span>
                        <span>{formatDate(row.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
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
