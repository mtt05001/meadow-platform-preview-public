import { NextResponse } from "next/server";
import { claimIntakeForSending, updateIntakeFields } from "@/lib/db";
import { searchContact, getOpportunityWithFacilitator, addNote } from "@/lib/ghl";
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

    // Lookup contact and facilitator
    let facilitatorEmail: string | null = null;
    const { contact } = await searchContact(clientEmail);
    if (contact) {
      const { facilitatorEmail: fac } = await getOpportunityWithFacilitator(contact.id);
      facilitatorEmail = fac;
    }

    // --- STEP 1: Atomically claim intake as "sending" (prevents double-approve) ---
    const claimed = await claimIntakeForSending(id, approvedBy, approvedAt);
    if (!claimed) {
      return apiError("Intake is not pending — may have already been approved", 409);
    }

    // --- STEP 2: Send email to patient via Gmail API ---
    const subject = `Meadow Medication Guidance - ${clientName}`;
    const { ok, error: emailError } = await sendEmail(
      clientEmail,
      subject,
      cleanEmail,
      facilitatorEmail || undefined,
    );
    if (!ok) {
      // Revert to pending — email failed
      await updateIntakeFields(id, {
        status: "pending",
        approved_by: null,
        approved_at: null,
      });
      return apiError(`Email send failed: ${emailError}`);
    }

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

    // Add approval note to GHL contact (fire-and-forget)
    if (contact) {
      const noteBody = `[HI_APPROVAL] approved_by=${approvedBy} | approved_at=${approvedAt} | intake_id=${id}`;
      addNote(contact.id, noteBody).catch(() => {});
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
