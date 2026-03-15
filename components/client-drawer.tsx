"use client";

import type { Client } from "@/lib/types";
import RiskTierBadge from "@/components/risk-tier-badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

const stageGroupColors: Record<string, string> = {
  onboarding: "bg-amber-100 text-amber-800 border-amber-200",
  prep: "bg-blue-100 text-blue-800 border-blue-200",
  journey: "bg-purple-100 text-purple-800 border-purple-200",
  integration: "bg-teal-100 text-teal-800 border-teal-200",
  done: "bg-gray-100 text-gray-600 border-gray-200",
};

function DateCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#e8e2d8] bg-white px-3 py-2 text-center">
      <div className="text-[11px] text-[#7f8c8d] font-medium uppercase tracking-wide mb-0.5">
        {label}
      </div>
      <div className="text-[13px] font-semibold text-[#2c3e50]">
        {value || "\u2014"}
      </div>
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
    <div className="space-y-2">
      <h4 className="text-[13px] font-semibold text-[#1a4d2e] uppercase tracking-wide">
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

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[440px] sm:max-w-[440px] overflow-y-auto bg-[#f5f1eb]">
        <SheetHeader className="pb-4 border-b border-[#e8e2d8]">
          <SheetTitle className="text-[20px] text-[#1a4d2e]">
            {client.name}
          </SheetTitle>
          <div className="space-y-1 text-[13px] text-[#5a6c7d]">
            {client.email && <div>{client.email}</div>}
            {client.phone && <div>{client.phone}</div>}
          </div>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Overview */}
          <Section title="Overview">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] text-[#7f8c8d] mb-0.5">Stage</div>
                <Badge
                  variant="outline"
                  className={`text-[12px] ${groupColor}`}
                >
                  {client.stage_name}
                </Badge>
              </div>
              <div>
                <div className="text-[11px] text-[#7f8c8d] mb-0.5">
                  Facilitator
                </div>
                <div className="text-[13px] font-medium text-[#2c3e50]">
                  {client.facilitator || "\u2014"}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#7f8c8d] mb-0.5">
                  HI Status
                </div>
                <div className="text-[13px] font-medium text-[#2c3e50]">
                  {client.hi_status || "\u2014"}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#7f8c8d] mb-0.5">
                  Chart Status
                </div>
                <div className="text-[13px] font-medium text-[#2c3e50]">
                  {client.chart_status || "\u2014"}
                </div>
              </div>
            </div>
          </Section>

          {/* Session Schedule */}
          <Section title="Session Schedule">
            <div className="grid grid-cols-2 gap-2">
              <DateCard label="Prep 1" value={client.prep1} />
              <DateCard label="Prep 2" value={client.prep2} />
              <DateCard label="IP Prep" value={client.ip_prep} />
              <DateCard label="Journey" value={client.journey} />
              <DateCard label="IP Integ" value={client.ip_integ} />
              <DateCard label="Integ 1" value={client.integ1} />
              <DateCard label="Integ 2" value={client.integ2} />
            </div>
          </Section>

          {/* Health Intake */}
          {client.intake_id && (
            <Section title="Health Intake">
              <div className="space-y-3 rounded-lg border border-[#e8e2d8] bg-white p-4">
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
                    <p className="text-[12px] text-[#5a6c7d] whitespace-pre-wrap">
                      {client.edited_risk_strat}
                    </p>
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
