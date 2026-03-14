import { NextResponse } from "next/server";
import { searchContact, getOpportunityWithFacilitator } from "@/lib/ghl";
import { apiError, getErrorMessage } from "@/lib/api-utils";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body.email;
    if (!email) {
      return apiError("Missing email", 400);
    }

    const { contact, error: contactError } = await searchContact(email);
    if (!contact) {
      return NextResponse.json({ facilitator_email: null, error: contactError });
    }

    const { facilitatorEmail, error: oppError } = await getOpportunityWithFacilitator(contact.id);
    return NextResponse.json({
      facilitator_email: facilitatorEmail,
      contact_id: contact.id,
      error: oppError,
    });
  } catch (e) {
    return apiError(getErrorMessage(e));
  }
}
