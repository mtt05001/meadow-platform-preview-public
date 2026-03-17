import { google } from "googleapis";

function getCredentials() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_B64;
  if (!b64) throw new Error("GOOGLE_SERVICE_ACCOUNT_B64 not set");
  const json = Buffer.from(b64, "base64").toString("utf-8");
  return JSON.parse(json);
}

export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string,
  cc?: string,
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  try {
    const creds = getCredentials();

    const auth = new google.auth.JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: ["https://www.googleapis.com/auth/gmail.send"],
      subject: "dass@meadowmedicine.org",
    });

    const gmail = google.gmail({ version: "v1", auth });

    // Build MIME message
    const headers = [
      `From: Meadow Medicine <care@meadowmedicine.org>`,
      `To: ${to}`,
      cc ? `Cc: ${cc}` : "",
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset="UTF-8"`,
      `Content-Transfer-Encoding: base64`,
    ]
      .filter(Boolean)
      .join("\r\n");

    const encodedBody = Buffer.from(htmlBody, "utf-8").toString("base64");
    const raw = Buffer.from(headers + "\r\n\r\n" + encodedBody).toString("base64url");

    const result = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });

    return { ok: true, messageId: result.data.id ?? undefined };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
