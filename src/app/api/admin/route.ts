import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import {
  getAllTeams,
  getFinalSubmissions,
  getCompetition,
  getLeaderboard,
  getViolations,
  getCompetitionStats,
  getViolationCount,
} from "@/lib/database";
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

    const allTeams = getAllTeams();
    const submissions = getFinalSubmissions(); // Use final submissions only
    const competition = getCompetition();
    const leaderboard = getLeaderboard();
    const violations = getViolations();
    const stats = getCompetitionStats();

    // Convert teams to object format with violation counts and ban status
    const teams: Record<string, { 
      password: string; 
      isAdmin: boolean; 
      score: number; 
      solved: number[]; 
      team_size: number; 
      registration_numbers: string;
      violations: number;
      is_banned: boolean;
    }> = {};
    
    allTeams.forEach((team) => {
      teams[team.name] = {
        password: team.password,
        isAdmin: team.is_admin,
        score: team.score,
        solved: team.solved,
        team_size: team.team_size,
        registration_numbers: team.registration_numbers,
        violations: getViolationCount(team.name),
        is_banned: team.is_banned,
      };
    });

    return NextResponse.json({
      success: true,
      isMasterAdmin: session.user.isMasterAdmin || false,
      teams: teams,
      submissions: submissions,
      competition: competition,
      leaderboard: leaderboard,
      violations: violations,
      stats: stats,
    });
  } catch (error) {
    console.error("Admin API error:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
