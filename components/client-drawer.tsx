"use client";

import type { Client } from "@/lib/types";
import RiskTierBadge from "@/components/risk-tier-badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const stageGroupColors: Record<string, string> = {
  onboarding: "bg-amber-100 text-amber-800 border-amber-200",
  prep: "bg-blue-100 text-blue-800 border-blue-200",
  journey: "bg-purple-100 text-purple-800 border-purple-200",
  integration: "bg-teal-100 text-teal-800 border-teal-200",
  done: "bg-gray-100 text-gray-600 border-gray-200",
};

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-[#7f8c8d] mb-0.5">{label}</div>
      <div className="text-[13px] font-medium text-[#2c3e50]">{children}</div>
    </div>
  );
}

function SessionDate({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[#f0ede8] last:border-b-0">
      <span className="text-[12px] text-[#7f8c8d]">{label}</span>
      <span className="text-[13px] font-medium text-[#2c3e50]">{value}</span>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="text-[11px] font-semibold text-[#7f8c8d] uppercase tracking-wider mb-2">
        {title}
      </h4>
      {children}
    </div>
  );
}

export default function ClientDrawer({
  client,
  open,
  onClose,
}: {
  client: Client | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!client) return null;

  const groupColor =
    stageGroupColors[client.stage_group] || stageGroupColors.done;

  const sessions = [
    { label: "Prep 1", value: client.prep1 },
    { label: "Prep 2", value: client.prep2 },
    { label: "IP Prep", value: client.ip_prep },
    { label: "Journey", value: client.journey },
    { label: "IP Integ", value: client.ip_integ },
    { label: "Integ 1", value: client.integ1 },
    { label: "Integ 2", value: client.integ2 },
  ];
  const hasSessions = sessions.some((s) => s.value);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[420px] sm:max-w-[420px] overflow-y-auto bg-[#f5f1eb] p-0">
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-[#e8e2d8]">
          <SheetTitle className="text-[20px] text-[#1a4d2e] leading-tight">
            {client.name}
          </SheetTitle>
          <div className="flex flex-col gap-0.5 text-[13px] text-[#5a6c7d] mt-1">
            {client.email && <div>{client.email}</div>}
            {client.phone && <div>{client.phone}</div>}
          </div>
        </SheetHeader>

        <div className="px-6 py-5 space-y-5">
          {/* Overview */}
          <Section title="Overview">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <InfoRow label="Stage">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium border ${groupColor}`}
                >
                  {client.stage_name}
                </span>
              </InfoRow>
              <InfoRow label="Facilitator">
                {client.facilitator || "\u2014"}
              </InfoRow>
              <InfoRow label="HI Status">
                {client.hi_status || "\u2014"}
              </InfoRow>
              <InfoRow label="Chart Status">
                {client.chart_status || "\u2014"}
              </InfoRow>
            </div>
          </Section>

          {/* Session Schedule — only show if at least one date exists */}
          {hasSessions && (
            <Section title="Session Schedule">
              <div className="rounded-lg border border-[#e8e2d8] bg-white px-4 py-1">
                {sessions.map((s) => (
                  <SessionDate key={s.label} label={s.label} value={s.value} />
                ))}
              </div>
            </Section>
          )}

          {/* Health Intake */}
          {client.intake_id && (
            <Section title="Health Intake">
              <div className="rounded-lg border border-[#e8e2d8] bg-white p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-[#7f8c8d]">
                    Risk Tier:
                  </span>
                  {client.risk_tier ? (
                    <RiskTierBadge tier={client.risk_tier} />
                  ) : (
                    <span className="text-[12px] text-[#7f8c8d]">{"\u2014"}</span>
                  )}
                </div>

                {client.hard_contra.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold text-[#c0392b] mb-1">
                      Hard Contraindications
                    </div>
                    <ul className="space-y-0.5 text-[12px] text-[#2c3e50]">
                      {client.hard_contra.map((c, i) => (
                        <li key={i}>
                          <span className="font-medium">{c.category}:</span>{" "}
                          {c.detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {client.soft_details.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold text-[#8a6d00] mb-1">
                      Soft Factors (score: {client.soft_score})
                    </div>
                    <ul className="space-y-0.5 text-[12px] text-[#2c3e50]">
                      {client.soft_details.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {client.edited_risk_strat && (
                  <div>
                    <div className="text-[11px] font-semibold text-[#2c3e50] mb-1">
                      Clinical Notes
                    </div>
                    <div
                      className="text-[12px] text-[#5a6c7d] prose prose-sm max-w-none
                        [&_h2]:text-[13px] [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1
                        [&_h3]:text-[12px] [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1
                        [&_ol]:list-decimal [&_ol]:ml-4 [&_ol]:space-y-0.5
                        [&_ul]:list-disc [&_ul]:ml-4 [&_ul]:space-y-0.5
                        [&_li]:text-[12px] [&_strong]:text-[#2c3e50]
                        [&_p]:mb-1"
                      dangerouslySetInnerHTML={{ __html: client.edited_risk_strat }}
                    />
                  </div>
                )}

                {client.approved_by && (
                  <div className="text-[11px] text-[#7f8c8d] border-t border-[#e8e2d8] pt-2">
                    Approved by {client.approved_by}
                    {client.approved_at && (
                      <> on {new Date(client.approved_at).toLocaleDateString()}</>
                    )}
                  </div>
                )}

                {client.intake_url && (
                  <a
                    href={client.intake_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-[12px] text-[#2d7a4a] hover:underline font-medium"
                  >
                    View Full Intake &rarr;
                  </a>
                )}
              </div>
            </Section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
