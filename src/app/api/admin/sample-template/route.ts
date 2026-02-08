import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import { cookies } from "next/headers";

export async function GET() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  if (!session.user || !session.user.isAdmin) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  // Create CSV content (Excel-compatible)
  const csvContent = `registration_number,phone_number,team_name
2021CS001,9876543210,Team Alpha
2021CS002,9876543211,Team Beta
2021CS003,9876543212,Team Gamma`;

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=team_template.csv",
    },
  });
}
