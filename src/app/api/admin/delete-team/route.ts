import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import { deleteTeam } from "@/lib/database";
import { cookies } from "next/headers";

// Disable caching
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  if (!session.user || !session.user.isAdmin) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  const { teamName } = await request.json();
  
  const success = deleteTeam(teamName);
  
  if (!success) {
    return NextResponse.json(
      { success: false, message: "Failed to delete team or team not found" },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
