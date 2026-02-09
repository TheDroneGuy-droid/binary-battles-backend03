import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import { addTeam, getTeam } from "@/lib/database";
import { cookies } from "next/headers";

// Disable caching
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface TeamRow {
  registration_number: string;
  phone_number: string;
  team_name?: string;
}

export async function POST(request: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  if (!session.user || !session.user.isAdmin) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { teams } = await request.json() as { teams: TeamRow[] };

    if (!teams || !Array.isArray(teams) || teams.length === 0) {
      return NextResponse.json(
        { success: false, message: "No valid team data provided" },
        { status: 400 }
      );
    }

    const results: { success: boolean; teamName: string; password: string; error?: string }[] = [];

    for (const team of teams) {
      const registrationNumber = String(team.registration_number).trim();
      const phoneNumber = String(team.phone_number).trim();
      const teamName = team.team_name?.trim() || registrationNumber;

      if (!registrationNumber || !phoneNumber) {
        results.push({
          success: false,
          teamName: registrationNumber || "Unknown",
          password: "",
          error: "Missing registration number or phone number",
        });
        continue;
      }

      // Password is last 4 digits of phone number
      const password = phoneNumber.slice(-4);

      if (password.length < 4) {
        results.push({
          success: false,
          teamName,
          password: "",
          error: "Phone number must have at least 4 digits",
        });
        continue;
      }

      // Check if team already exists
      const existingTeam = getTeam(teamName);
      if (existingTeam) {
        results.push({
          success: false,
          teamName,
          password,
          error: "Team already exists",
        });
        continue;
      }

      // Add team with registration number as ID
      const success = addTeam(teamName, password, 1, registrationNumber);

      results.push({
        success,
        teamName,
        password,
        error: success ? undefined : "Failed to add team",
      });
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `Added ${successCount} teams, ${failCount} failed`,
      results,
    });
  } catch (error) {
    console.error("Bulk upload error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to process upload" },
      { status: 500 }
    );
  }
}
