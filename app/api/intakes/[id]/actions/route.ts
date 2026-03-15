import { NextResponse } from "next/server";
import { updateIntakeFields, deleteIntake } from "@/lib/db";
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
    const action = body.action;

    if (!["archive", "delete"].includes(action)) {
      return apiError("Invalid action", 400);
    }

    if (action === "archive") {
      await updateIntakeFields(id, { status: "archived" });
      return NextResponse.json({ success: true, message: `Archived ${id}` });
    } else {
      await deleteIntake(id);
      return NextResponse.json({ success: true, message: `Deleted ${id}` });
    }
  } catch (e) {
    return apiError(getErrorMessage(e));
  }
}
