import { NextResponse } from "next/server";
import { fetchSubmissionPdf } from "@/lib/jotform";
import { apiError, getErrorMessage } from "@/lib/api-utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const pdfResponse = await fetchSubmissionPdf(id);
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
