import { NextResponse } from "next/server";
import { claimIntakeForSending, updateIntakeFields } from "@/lib/db";
import { searchContact, getOpportunityWithFacilitator, addNote, updateOpportunity, getAppUrl } from "@/lib/ghl";
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
    const body = await request.json();

    const clientEmail = body.client_email;
    const clientName = body.client_name || "Client";
    const editedEmail = body.edited_email;
    const riskStratification = body.risk_stratification || "";
    const approvedBy = body.approved_by || "Dr. Tracy Townsend";
    const approvedAt = body.approved_at || new Date().toISOString();

    if (!clientEmail || !editedEmail) {
      return apiError("Missing required fields: client_email or edited_email", 400);
    }

    // Content from Quill is already HTML — use directly
    let cleanEmail = editedEmail.trim();
    if (!cleanEmail.startsWith("<")) {
      // Legacy markdown fallback
      cleanEmail = cleanEmail.replace(/^\*?\*?Subject line:\*?\*?[^\n]*\n*/im, "");
      cleanEmail = cleanEmail.replace(/###\s*(.+)/g, '<h3 style="margin:16px 0 2px 0;">$1</h3>');
      cleanEmail = "<p>" + cleanEmail.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>") + "</p>";
    }

    // Lookup contact, opportunity, and facilitator
    let facilitatorEmail: string | null = null;
    let oppId: string | null = null;
    const { contact, error: contactErr } = await searchContact(clientEmail);
    if (contact) {
      console.log(`[APPROVE] GHL contact found: ${contact.id} for ${clientEmail}`);
      const { opportunity, facilitatorEmail: fac, error: oppErr } = await getOpportunityWithFacilitator(contact.id);
      facilitatorEmail = fac;
      oppId = (opportunity?.id as string) || null;
      if (oppId) {
        console.log(`[APPROVE] GHL opportunity found: ${oppId}`);
      } else {
        console.warn(`[APPROVE] No GHL opportunity for contact ${contact.id}: ${oppErr}`);
      }
    } else {
      console.warn(`[APPROVE] GHL contact not found for ${clientEmail}: ${contactErr}`);
    }

    // --- STEP 1: Atomically claim intake as "sending" (prevents double-approve) ---
    const claimed = await claimIntakeForSending(id, approvedBy, approvedAt);
    if (!claimed) {
      return apiError("Intake is not pending — may have already been approved", 409);
    }

    // --- STEP 2: Send email to patient via Gmail API ---
    const subject = `Meadow Medication Guidance - ${clientName}`;
    console.log(`[APPROVE] Sending email to ${clientEmail}${facilitatorEmail ? ` (cc: ${facilitatorEmail})` : ""}`);
    const { ok, messageId, error: emailError } = await sendEmail(
      clientEmail,
      subject,
      cleanEmail,
      facilitatorEmail || undefined,
    );
    if (!ok) {
      console.error(`[APPROVE] Gmail send failed for ${clientEmail}: ${emailError}`);
      // Revert to pending — email failed
      await updateIntakeFields(id, {
        status: "pending",
        approved_by: null,
        approved_at: null,
      });
      return apiError(`Email send failed: ${emailError}`);
    }
    console.log(`[APPROVE] Gmail send succeeded — messageId: ${messageId}`);

    // --- STEP 3: Mark as approved ---
    try {
      await updateIntakeFields(id, { status: "approved" });
    } catch (dbErr) {
      // Email was sent but final status update failed — stuck on "sending"
      console.error(`[APPROVE] DB update to "approved" failed for ${id}:`, dbErr);
      return NextResponse.json({
        success: true,
        partial: true,
        message: "Email sent but status update failed — record stuck on 'sending'",
        intake_id: id,
        facilitator_email: facilitatorEmail,
      });
    }

    // Update GHL (fire-and-forget)
    if (contact) {
      const noteBody = `[HI_APPROVAL] approved_by=${approvedBy} | approved_at=${approvedAt} | intake_id=${id}`;
      addNote(contact.id, noteBody).catch((e) => console.error(`[APPROVE] GHL addNote failed:`, e));
    }
    if (oppId) {
      const hiUrl = `${getAppUrl()}/intakes/${id}/readonly`;
      console.log(`[APPROVE] Setting HI_URL on opportunity ${oppId}: ${hiUrl}`);
      updateOpportunity(oppId, { hiUrl }).then(
        (r) => r.ok
          ? console.log(`[APPROVE] HI_URL updated successfully`)
          : console.error(`[APPROVE] HI_URL update failed: ${r.error}`),
        (e) => console.error(`[APPROVE] HI_URL update threw:`, e),
      );
    } else {
      console.warn(`[APPROVE] Skipping HI_URL update — no opportunity found`);
    }

    return NextResponse.json({
      success: true,
      message: "Email sent and GHL updated",
      intake_id: id,
      facilitator_email: facilitatorEmail,
    });
  } catch (e) {
    return apiError(getErrorMessage(e));
  }
}
