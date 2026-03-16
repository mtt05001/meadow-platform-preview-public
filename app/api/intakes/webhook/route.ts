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
  console.log("[jotform-webhook] Received POST");

  // Verify shared secret
  const secret = request.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.JOTFORM_WEBHOOK_SECRET) {
    console.warn("[jotform-webhook] Unauthorized — bad or missing secret");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody: string | undefined;
  try {
    // Jotform sends application/x-www-form-urlencoded with multiple fields:
    // - submissionID (top-level form field — the actual ID)
    // - formID (top-level form field)
    // - rawRequest (JSON blob with all form answers)
    const formData = await request.formData();

    // Submission ID is a top-level form field, NOT inside rawRequest
    const submissionId = String(
      formData.get("submissionID") || formData.get("submission_id") || "",
    );
    console.log(`[jotform-webhook] Submission ID: ${submissionId}, Form ID: ${formData.get("formID")}`);

    if (!submissionId) {
      const keys = [...formData.keys()];
      console.error(`[jotform-webhook] No submission ID. FormData keys: ${keys.join(", ")}`);

      // Fallback: try rawRequest for event_id
      const rawRequest = formData.get("rawRequest");
      if (rawRequest && typeof rawRequest === "string") {
        const payload = JSON.parse(rawRequest) as Record<string, unknown>;
        console.error(`[jotform-webhook] rawRequest keys: ${Object.keys(payload).join(", ")}`);
      }
      return NextResponse.json({ error: "Missing submission ID" }, { status: 400 });
    }

    // Skip if already processed (idempotent)
    const existing = await getIntakeById(submissionId);
    if (existing) {
      console.log(`[jotform-webhook] ${submissionId} already exists, skipping`);
      return NextResponse.json({ success: true, skipped: true });
    }

    // Fetch full submission from Jotform API (webhook payload format differs from API)
    const submission = await fetchSubmissionById(submissionId);
    if (!submission) {
      console.error(`[jotform-webhook] Could not fetch submission ${submissionId} from Jotform API`);
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // Process: extract → risk engine → AI → save
    const client = extractClientData(submission);
    console.log(`[jotform-webhook] Extracted: ${client.name} <${client.email}>`);

    const hardFlags = scanHardContraindications(client);
    const { score: softScore, details: softDetails } = scoreSoftContraindications(client);
    const { tier, explanation } = assignRiskTier(hardFlags, softScore);
    console.log(`[jotform-webhook] Risk: tier=${tier}, hard=${hardFlags.length}, soft=${softScore}`);

    const { result: aiOutput, error: aiError } = await generateAiOutput(
      client as unknown as Record<string, unknown>,
    );
    if (aiError) {
      console.warn(`[jotform-webhook] AI generation failed: ${aiError} — saving without AI output`);
    } else {
      console.log(`[jotform-webhook] AI output generated`);
    }

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

    console.log(`[jotform-webhook] Done: ${client.name} saved (${tier})`);
    return NextResponse.json({ success: true, name: client.name, tier });
  } catch (e) {
    console.error(`[jotform-webhook] Error: ${getErrorMessage(e)}`);
    if (rawBody) {
      console.error(`[jotform-webhook] Raw payload (first 500 chars): ${rawBody.slice(0, 500)}`);
    }
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}
