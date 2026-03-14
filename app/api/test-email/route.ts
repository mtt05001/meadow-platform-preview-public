import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/gmail";
import { apiError, getErrorMessage } from "@/lib/api-utils";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to;
    const subject = body.subject || "Test Email from Meadow Platform";
    const html = body.html || "<p>This is a test email from the Meadow Platform.</p>";

    if (!to) {
      return apiError("Missing 'to' email", 400);
    }

    const { ok, messageId, error } = await sendEmail(to, subject, html);
    if (!ok) {
      return apiError(error || "Failed to send email");
    }

    return NextResponse.json({ success: true, messageId });
  } catch (e) {
    return apiError(getErrorMessage(e));
  }
}
