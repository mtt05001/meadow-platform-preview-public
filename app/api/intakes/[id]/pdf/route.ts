import { NextResponse } from "next/server";
import { fetchSubmissionPdf } from "@/lib/jotform";
import { apiError, getErrorMessage } from "@/lib/api-utils";
import { auth } from "@clerk/nextjs/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await auth.protect();
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const formId = searchParams.get("form_id") || undefined;
    const pdfResponse = await fetchSubmissionPdf(id, formId);
    if (!pdfResponse.ok) {
      return apiError("PDF not found", 404);
    }
    const buffer = await pdfResponse.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="intake-${id}.pdf"`,
      },
    });
  } catch (e) {
    return apiError(getErrorMessage(e));
  }
}
