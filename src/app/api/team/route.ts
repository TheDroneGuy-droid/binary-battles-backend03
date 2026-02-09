import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import { getTeam, getLeaderboard, isTeamBanned } from "@/lib/database";
import { problems } from "@/lib/data";
import { cookies } from "next/headers";

// Disable caching for team endpoint
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    if (!session.user) {
      return NextResponse.json({ success: false, message: "Not authenticated", reason: "no_session" }, { status: 401 });
    }

    if (session.user.isAdmin) {
      return NextResponse.json({ success: false, message: "Admin users should use admin page", reason: "is_admin" }, { status: 403 });
    }

    const team = getTeam(session.user.name);

    if (!team) {
      // Team was deleted - destroy the session to prevent redirect loops
      session.destroy();
      await session.save();
      return NextResponse.json({ success: false, message: "Team not found", reason: "team_not_found" }, { status: 404 });
    }

    // Check if team is banned
    if (isTeamBanned(session.user.name)) {
      session.destroy();
      await session.save();
      return NextResponse.json({ 
        success: false, 
        message: "Your team has been banned from the competition. Please contact the POC.", 
        reason: "team_banned" 
      }, { status: 403 });
    }

    const teamData = {
      score: team.score,
      solved: team.solved,
      failed: team.failed,
    };

    const leaderboard = getLeaderboard().map((entry) => ({
      name: entry.name,
      score: entry.score,
      solved: entry.solved,
    }));

    return NextResponse.json({
      success: true,
      teamName: session.user.name,
      problems: problems,
      teamData: teamData,
      leaderboard: leaderboard,
    });
  } catch (error) {
    console.error("Team API error:", error);
    return NextResponse.json({ success: false, message: "Server error", reason: "server_error" }, { status: 500 });
  }
}
