import { NextRequest, NextResponse } from "next/server";
import { getIntakeById, upsertIntake } from "@/lib/db";
import { fetchSubmissionById } from "@/lib/jotform";
import {
  extractClientData,
  scanHardContraindications,
  scoreSoftContraindications,
  assignRiskTier,
} from "@/lib/risk-engine";
import { generateAiOutput } from "@/lib/ai";
import { getErrorMessage } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  // Verify shared secret
  const secret = request.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.JOTFORM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Jotform sends application/x-www-form-urlencoded with a rawRequest field
    const formData = await request.formData();
    const rawRequest = formData.get("rawRequest");

    if (!rawRequest || typeof rawRequest !== "string") {
      return NextResponse.json({ error: "Missing rawRequest" }, { status: 400 });
    }

    const payload = JSON.parse(rawRequest) as Record<string, unknown>;
    const submissionId = String(payload.submissionID || payload.id || "");

    if (!submissionId) {
      return NextResponse.json({ error: "Missing submission ID" }, { status: 400 });
    }

    // Skip if already processed (idempotent)
    const existing = await getIntakeById(submissionId);
    if (existing) {
      console.log(`[jotform-webhook] Submission ${submissionId} already exists, skipping`);
      return NextResponse.json({ success: true, skipped: true });
    }

    // Fetch full submission from Jotform API (webhook payload format differs from API)
    const submission = await fetchSubmissionById(submissionId);
    if (!submission) {
      console.error(`[jotform-webhook] Could not fetch submission ${submissionId}`);
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // Process: extract → risk engine → AI → save
    const client = extractClientData(submission);
    const hardFlags = scanHardContraindications(client);
    const { score: softScore, details: softDetails } = scoreSoftContraindications(client);
    const { tier, explanation } = assignRiskTier(hardFlags, softScore);
    console.log(`[jotform-webhook] ${client.name}: tier=${tier}, hard=${hardFlags.length}, soft=${softScore}`);

    const { result: aiOutput } = await generateAiOutput(
      client as unknown as Record<string, unknown>,
    );
    console.log(`[jotform-webhook] ${client.name}: AI output generated`);

    await upsertIntake({
      id: submissionId,
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
      jotform_data: submission,
    });

    console.log(`[jotform-webhook] ${client.name}: saved to DB`);
    return NextResponse.json({ success: true, name: client.name, tier });
  } catch (e) {
    console.error(`[jotform-webhook] Error: ${getErrorMessage(e)}`);
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}
