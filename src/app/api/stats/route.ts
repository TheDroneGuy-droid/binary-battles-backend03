import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import { getCompetitionStats, getTeamActivity } from "@/lib/database";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    if (!session.user || !session.user.isAdmin) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const stats = getCompetitionStats();
    const recentActivity = getTeamActivity(undefined, 100);

    return NextResponse.json({ 
      success: true, 
      stats,
      recentActivity
    });
  } catch (error) {
    console.error("Stats API error:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
