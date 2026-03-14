import { NextResponse } from "next/server";
import { getIntakes, upsertIntake } from "@/lib/db";
import { fetchRecentSubmissions } from "@/lib/jotform";
import {
  extractClientData,
  scanHardContraindications,
  scoreSoftContraindications,
  assignRiskTier,
} from "@/lib/risk-engine";
import { generateAiOutput } from "@/lib/ai";
import { apiError, getErrorMessage } from "@/lib/api-utils";

export async function POST() {
  try {
    // 1. Load existing intake IDs from DB
    const existing = await getIntakes(500);
    const existingIds = new Set(existing.map((i) => i.id));

    // 2. Fetch recent Jotform submissions from Jotform API
    const submissions = await fetchRecentSubmissions(undefined, 20);

    // 3. Find new submissions
    const newSubs = submissions.filter((s) => !existingIds.has(String(s.id)));

    if (!newSubs.length) {
      return NextResponse.json({
        success: true,
        new_count: 0,
        message: "No new submissions found",
      });
    }

    // 4. Process each new submission
    let newCount = 0;
    const errors: string[] = [];

    for (const sub of newSubs) {
      try {
        const client = extractClientData(sub);
        const hardFlags = scanHardContraindications(client);
        const { score: softScore, details: softDetails } =
          scoreSoftContraindications(client);
        const { tier, explanation } = assignRiskTier(hardFlags, softScore);

        // AI generation
        const { result: aiOutput } = await generateAiOutput(
          client as unknown as Record<string, unknown>,
        );

        await upsertIntake({
          id: String(sub.id),
          name: client.name,
          email: client.email,
          submitted_at: client.submitted_at,
          risk_tier: tier,
          status: "pending",
          hard_contraindications: hardFlags,
          soft_score: softScore,
          soft_details: softDetails,
          risk_tier_explanation: explanation,
          client_data: client,
          ai_output: aiOutput || {},
          jotform_data: sub,
        });

        newCount++;
      } catch (e) {
        errors.push(`Sub ${sub.id}: ${getErrorMessage(e).slice(0, 100)}`);
      }
    }

    return NextResponse.json({
      success: true,
      new_count: newCount,
      errors: errors.slice(0, 10),
      message: `Found ${newCount} new intake(s)`,
    });
  } catch (e) {
    return apiError(getErrorMessage(e));
  }
}
