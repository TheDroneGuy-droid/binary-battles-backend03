import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import { addTeam, getTeam, setTeamMembers } from "@/lib/database";
import { cookies } from "next/headers";

// Disable caching
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface TeamRow {
  registration_number: string;
  phone_number: string;
  team_name?: string;
}

interface GroupedTeam {
  teamName: string;
  members: { registrationNumber: string; phoneNumber: string }[];
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

    // Group rows by team_name to support relay race (multiple members per team)
    const groupedTeams: Map<string, GroupedTeam> = new Map();

    for (const row of teams) {
      const registrationNumber = String(row.registration_number).trim();
      const phoneNumber = String(row.phone_number).trim();
      const teamName = row.team_name?.trim() || registrationNumber;

      if (!registrationNumber || !phoneNumber) {
        continue; // Skip invalid rows
      }

      if (!groupedTeams.has(teamName)) {
        groupedTeams.set(teamName, { teamName, members: [] });
      }
      groupedTeams.get(teamName)!.members.push({ registrationNumber, phoneNumber });
    }

    const results: { success: boolean; teamName: string; password: string; memberCount: number; error?: string }[] = [];

    for (const [teamName, group] of groupedTeams) {
      const members = group.members;

      // Validate member count (2-4 for relay)
      if (members.length < 2 || members.length > 4) {
        results.push({
          success: false,
          teamName,
          password: "",
          memberCount: members.length,
          error: `Team must have 2-4 members, got ${members.length}`,
        });
        continue;
      }

      // Password is last 4 digits of first member's phone number
      const password = members[0].phoneNumber.slice(-4);

      if (password.length < 4) {
        results.push({
          success: false,
          teamName,
          password: "",
          memberCount: members.length,
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
          memberCount: members.length,
          error: "Team already exists",
        });
        continue;
      }

      // Registration numbers joined for the team
      const registrationNumbers = members.map(m => m.registrationNumber).join(",");

      // Add team
      const teamAdded = addTeam(teamName, password, members.length, registrationNumbers);

      if (!teamAdded) {
        results.push({
          success: false,
          teamName,
          password,
          memberCount: members.length,
          error: "Failed to add team",
        });
        continue;
      }

      // Set team members for relay
      const memberIds = members.map(m => m.registrationNumber);
      setTeamMembers(teamName, memberIds);

      results.push({
        success: true,
        teamName,
        password,
        memberCount: members.length,
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
