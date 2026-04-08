import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIntakeById, getPatientByGhlContactId, upsertPatient } from "@/lib/db";
import {
  searchContact,
  updateContactCustomFields,
  GHL_CONTACT_FIELDS,
} from "@/lib/ghl";
import { apiError, getErrorMessage } from "@/lib/api-utils";

interface ResolvedContact {
  contactId: string;
  email: string;
  name: string | null;
}

async function resolveContact(
  intakeId: string,
): Promise<{ contact: ResolvedContact | null; error: string | null }> {
  const intake = await getIntakeById(intakeId);
  if (!intake) return { contact: null, error: "Intake not found" };
  if (!intake.email) return { contact: null, error: "Intake has no email" };
  const { contact, error } = await searchContact(intake.email);
  if (error || !contact) return { contact: null, error: error || "Contact not found" };
  const name =
    [contact.firstName, contact.lastName].filter(Boolean).join(" ") || intake.name || null;
  return {
    contact: { contactId: contact.id, email: intake.email.toLowerCase(), name },
    error: null,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await auth.protect();
  try {
    const { id } = await params;
    const { contact, error } = await resolveContact(id);
    if (!contact) return apiError(error || "Contact not found", 404);
    const patient = await getPatientByGhlContactId(contact.contactId);
    return NextResponse.json({ value: patient?.medically_complex || "" });
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
    const { contact, error } = await resolveContact(id);
    if (!contact) return apiError(error || "Contact not found", 404);

    // Write to GHL first — if it fails, don't persist locally (keeps DB and GHL in sync).
    const { ok, error: updateErr } = await updateContactCustomFields(contact.contactId, [
      { id: GHL_CONTACT_FIELDS.MEDICALLY_COMPLEX, value },
    ]);
    if (!ok) return apiError(updateErr || "GHL update failed");

    await upsertPatient(contact.contactId, {
      email: contact.email,
      name: contact.name,
      medically_complex: value,
    });
    return NextResponse.json({ value });
  } catch (e) {
    return apiError(getErrorMessage(e));
  }
}
