import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/gmail";
import { apiError, getErrorMessage } from "@/lib/api-utils";
import { auth } from "@clerk/nextjs/server";

export async function POST(request: Request) {
  await auth.protect();
  try {
    const body = await request.json();
    const to = body.to;
    const subject = body.subject || "Test Email from Meadow Platform";
    const html = body.html || "<p>This is a test email from the Meadow Platform.</p>";

    if (!to) {
      return apiError("Missing 'to' email", 400);
    }

    console.log(`[test-email] to=${JSON.stringify(to)} subject=${JSON.stringify(subject)} html_length=${html?.length}`);

    const { ok, messageId, error } = await sendEmail(to, subject, html);
    if (!ok) {
      return apiError(error || "Failed to send email");
    }

    return NextResponse.json({ success: true, messageId });
  } catch (e) {
    return apiError(getErrorMessage(e));
  }
}
