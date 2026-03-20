import { NextResponse } from "next/server";
import { getIntakeById } from "@/lib/db";
import { searchContact, getOpportunityWithFacilitator } from "@/lib/ghl";
import { sendEmail } from "@/lib/gmail";
import { apiError, getErrorMessage } from "@/lib/api-utils";
import { auth } from "@clerk/nextjs/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await auth.protect();
  try {
    const { id } = await params;

    const intake = await getIntakeById(id);
    if (!intake) return apiError("Intake not found", 404);
    if (intake.status !== "approved") return apiError("Intake is not approved", 400);

    const aiOutput = intake.ai_output as Record<string, unknown> | null;
    const emailHtml = aiOutput?.email as string | undefined;
    if (!emailHtml) return apiError("No saved email to resend", 400);

    // Lookup facilitator for CC
    let facilitatorEmail: string | null = null;
    const { contact } = await searchContact(intake.email);
    if (contact) {
      const { facilitatorEmail: fac } = await getOpportunityWithFacilitator(contact.id);
      facilitatorEmail = fac;
    }

    const subject = `Meadow Medication Guidance - ${intake.name}`;
    console.log(`[RESEND] Sending email for intake ${id}`);
    const { ok, messageId, error: emailError } = await sendEmail(
      intake.email,
      subject,
      emailHtml,
      facilitatorEmail || undefined,
    );

    if (!ok) {
      console.error(`[RESEND] Gmail send failed for intake ${id}: ${emailError}`);
      return apiError(`Email send failed: ${emailError}`);
    }

    console.log(`[RESEND] Gmail send succeeded for intake ${id} — messageId: ${messageId}`);
    return NextResponse.json({ success: true, messageId });
  } catch (e) {
    return apiError(getErrorMessage(e));
  }
}
