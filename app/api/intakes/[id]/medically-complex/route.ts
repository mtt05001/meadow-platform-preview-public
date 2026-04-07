import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIntakeById } from "@/lib/db";
import {
  searchContact,
  fetchContact,
  updateContactCustomFields,
  cfVal,
  GHL_CONTACT_FIELDS,
} from "@/lib/ghl";
import { apiError, getErrorMessage } from "@/lib/api-utils";

type CF = { id: string; fieldValue?: string; fieldValueString?: string; value?: string };

async function resolveContactId(intakeId: string): Promise<{ contactId: string | null; error: string | null }> {
  const intake = await getIntakeById(intakeId);
  if (!intake) return { contactId: null, error: "Intake not found" };
  if (!intake.email) return { contactId: null, error: "Intake has no email" };
  const { contact, error } = await searchContact(intake.email);
  if (error || !contact) return { contactId: null, error: error || "Contact not found" };
  return { contactId: contact.id, error: null };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await auth.protect();
  try {
    const { id } = await params;
    const { contactId, error } = await resolveContactId(id);
    if (!contactId) return apiError(error || "Contact not found", 404);
    const { contact, error: fetchErr } = await fetchContact(contactId);
    if (!contact) return apiError(fetchErr || "Contact not found", 404);
    const customFields = (contact.customFields as CF[]) || [];
    const value = cfVal(customFields, GHL_CONTACT_FIELDS.MEDICALLY_COMPLEX);
    return NextResponse.json({ value });
  } catch (e) {
    return apiError(getErrorMessage(e));
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await auth.protect();
  try {
    const { id } = await params;
    const body = (await request.json()) as { value?: string };
    const value = body.value;
    if (value !== "Yes" && value !== "No" && value !== "") {
      return apiError("value must be 'Yes', 'No', or ''", 400);
    }
    const { contactId, error } = await resolveContactId(id);
    if (!contactId) return apiError(error || "Contact not found", 404);
    const { ok, error: updateErr } = await updateContactCustomFields(contactId, [
      { id: GHL_CONTACT_FIELDS.MEDICALLY_COMPLEX, value },
    ]);
    if (!ok) return apiError(updateErr || "Update failed");
    return NextResponse.json({ value });
  } catch (e) {
    return apiError(getErrorMessage(e));
  }
}
