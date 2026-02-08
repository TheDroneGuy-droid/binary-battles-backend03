import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import { banTeam, unbanTeam, isTeamBanned } from "@/lib/database";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  if (!session.user || !session.user.isAdmin) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  const { teamName, action } = await request.json();

  if (!teamName) {
    return NextResponse.json(
      { success: false, message: "Team name is required" },
      { status: 400 }
    );
  }

  let success = false;
  
  if (action === "ban") {
    success = banTeam(teamName);
  } else if (action === "unban") {
    success = unbanTeam(teamName);
  } else {
    // Toggle ban status
    const isBanned = isTeamBanned(teamName);
    success = isBanned ? unbanTeam(teamName) : banTeam(teamName);
  }

  if (!success) {
    return NextResponse.json(
      { success: false, message: "Failed to update team ban status" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
